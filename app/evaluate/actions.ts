'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isValidScoreValue } from '@/lib/scoring'
import { canEvaluatorEdit } from '@/lib/submission'
import { isAssignmentActive } from '@/lib/assignment'
import { scoringUnitsForScope } from '@/lib/criteria-scope'

// 채점 단위(unitId) 해석 — 지표별 모드면 Criterion.id, 통합(퉁) 모드면 CriterionSubitem.id.
// 세션 소속(과제 공통/레거시 세션) 검증까지 수행하고, 저장에 쓸 컬럼과 만점을 돌려준다.
async function resolveUnit(
  session: { id: string; projectId: string | null },
  unitId: string,
): Promise<{ kind: 'criterion' | 'subitem'; maxScore: number } | null> {
  const c = await prisma.criterion.findUnique({ where: { id: unitId }, select: { projectId: true, sessionId: true, maxScore: true } })
  if (c) {
    const belongs = session.projectId ? c.projectId === session.projectId : c.sessionId === session.id
    return belongs ? { kind: 'criterion', maxScore: c.maxScore } : null
  }
  const s = await prisma.criterionSubitem.findUnique({
    where: { id: unitId },
    select: { maxScore: true, group: { select: { projectId: true, sessionId: true } } },
  })
  if (!s || s.maxScore == null) return null
  const belongs = session.projectId ? s.group.projectId === session.projectId : s.group.sessionId === session.id
  return belongs ? { kind: 'subitem', maxScore: s.maxScore } : null
}

// 위원장 대상별 종합의견 저장 — 위원장 본인만, 진행 중·배정 유효한 분과에서만.
// 위원장의 종합의견 저장 — 위원장은 평가표 하단이 아니라 대상별 화면('통합의견')에서 쓴다.
// 저장 위치는 다른 위원과 같은 Opinion(위원×대상) 한 행이다.
// 의견서가 간사 검토 제출(SUBMITTED)되거나 관리자 승인(APPROVED)된 뒤에는 수정·삭제할 수 없다.
export async function saveChairOpinion(
  sessionId: string,
  subjectId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }
  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { chairId: true, status: true, opinionStatus: true },
  })
  if (!session || session.chairId !== user.id) return { ok: false, error: '위원장만 작성할 수 있습니다.' }
  if (session.status === 'CLOSED') return { ok: false, error: '마감된 분과입니다.' }
  // 형제 액션(autoSaveScore/saveScores)과 동일한 가드 — 진행 중 + 유효한 배정
  if (session.status !== 'IN_PROGRESS') return { ok: false, error: '진행 중인 심사에서만 작성할 수 있습니다.' }

  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    select: { status: true },
  })
  if (!assigned || !isAssignmentActive(assigned.status)) return { ok: false, error: '배정되지 않은 심사입니다.' }

  if (session.opinionStatus === 'SUBMITTED' || session.opinionStatus === 'APPROVED') {
    return { ok: false, error: '의견서가 제출/승인되어 수정할 수 없습니다.' }
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { sessionId: true } })
  if (!subject || subject.sessionId !== sessionId) return { ok: false, error: '해당 분과의 평가 대상이 아닙니다.' }

  // 위원장의 종합의견 — 위원장은 평가표 대신 이 화면('통합의견')에서만 작성한다.
  const text = String(formData.get('opinion') ?? '').trim()
  if (text) {
    await prisma.opinion.upsert({
      where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
      update: { text, sessionId },
      create: { evaluatorId: user.id, subjectId, sessionId, text },
    })
  } else {
    await prisma.opinion.deleteMany({ where: { evaluatorId: user.id, subjectId } })
  }
  revalidatePath(`/evaluate/${sessionId}/chair/${subjectId}`)
  return { ok: true }
}

// 평가위원이 현재 포커스(입력 중)한 항목을 기록 — 대시보드에서 '실제 입력 중' 항목만 애니메이션.
export async function pingEditing(sessionId: string, subjectId: string, criterionId: string) {
  const user = await getCurrentUser()
  if (!user) return
  await prisma.editingPresence.upsert({
    where: { evaluatorId: user.id },
    update: { sessionId, subjectId, criterionId, updatedAt: new Date() },
    create: { evaluatorId: user.id, sessionId, subjectId, criterionId, updatedAt: new Date() },
  })
}

// 입력 종료(블러/제출/이탈) — 현재 입력 중 표시 해제
export async function clearEditing() {
  const user = await getCurrentUser()
  if (!user) return
  await prisma.editingPresence.deleteMany({ where: { evaluatorId: user.id } })
}

// 단일 항목 자동 저장 — 입력/선택 즉시(디바운스) 저장하여 진행 상태가 실시간 반영되게 함.
// unitId = 지표(Criterion.id) 또는 통합 배점 세부항목(CriterionSubitem.id).
// 빈 값이면 해당 점수를 삭제(진행 상태 되돌림). evaluate 경로는 revalidate하지 않음(키 입력마다 리렌더 방지).
export async function autoSaveScore(
  sessionId: string,
  subjectId: string,
  unitId: string,
  raw: string,
): Promise<{ ok: boolean; cleared?: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }

  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.status !== 'IN_PROGRESS') return { ok: false, error: 'not-active' }

  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    select: { status: true },
  })
  if (!assigned || !isAssignmentActive(assigned.status)) return { ok: false, error: 'not-assigned' }

  const sub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    select: { status: true },
  })
  if (!canEvaluatorEdit(sub?.status ?? null)) return { ok: false, error: 'locked' }

  const unit = await resolveUnit(session, unitId)
  if (!unit) return { ok: false, error: 'bad-criterion' }
  const target = unit.kind === 'criterion' ? { criterionId: unitId } : { subitemId: unitId }

  if (raw === '' || raw == null) {
    await prisma.score.deleteMany({ where: { evaluatorId: user.id, subjectId, ...target } })
    return { ok: true, cleared: true }
  }

  const value = Number(raw)
  if (!isValidScoreValue(value, unit.maxScore)) return { ok: false, error: 'range' }

  if (unit.kind === 'criterion') {
    await prisma.score.upsert({
      where: { evaluatorId_subjectId_criterionId: { evaluatorId: user.id, subjectId, criterionId: unitId } },
      update: { value, grade: null, sessionId },
      create: { evaluatorId: user.id, subjectId, criterionId: unitId, sessionId, value, grade: null },
    })
  } else {
    await prisma.score.upsert({
      where: { evaluatorId_subjectId_subitemId: { evaluatorId: user.id, subjectId, subitemId: unitId } },
      update: { value, grade: null, sessionId },
      create: { evaluatorId: user.id, subjectId, subitemId: unitId, sessionId, value, grade: null },
    })
  }
  return { ok: true }
}

// 평가항목(그룹)별 의견 자동 저장 — 점수 자동 저장과 동일한 가드. 빈 값이면 삭제.
export async function autoSaveGroupComment(
  sessionId: string,
  subjectId: string,
  groupId: string,
  raw: string,
): Promise<{ ok: boolean; cleared?: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }

  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.status !== 'IN_PROGRESS') return { ok: false, error: 'not-active' }

  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    select: { status: true },
  })
  if (!assigned || !isAssignmentActive(assigned.status)) return { ok: false, error: 'not-assigned' }

  const sub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    select: { status: true },
  })
  if (!canEvaluatorEdit(sub?.status ?? null)) return { ok: false, error: 'locked' }

  // 평가항목은 과제(Project) 단위 공통 — 소속 검증(레거시: 세션 항목)
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { projectId: true, sessionId: true } })
  const belongs = !!g && (session.projectId ? g.projectId === session.projectId : g.sessionId === sessionId)
  if (!belongs) return { ok: false, error: 'bad-group' }

  const text = raw.trim()
  if (!text) {
    await prisma.groupComment.deleteMany({ where: { evaluatorId: user.id, subjectId, groupId } })
    return { ok: true, cleared: true }
  }
  await prisma.groupComment.upsert({
    where: { evaluatorId_subjectId_groupId: { evaluatorId: user.id, subjectId, groupId } },
    update: { text, sessionId },
    create: { evaluatorId: user.id, subjectId, groupId, sessionId, text },
  })
  return { ok: true }
}

// intent: 'save'(임시저장, 부분 허용) | 'submit'(제출, 전체 필수)
export async function saveScores(
  sessionId: string,
  subjectId: string,
  _prev: unknown,
  formData: FormData,
) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const intent = String(formData.get('intent') ?? 'submit')

  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.status !== 'IN_PROGRESS') {
    return { error: '진행 중인 심사에서만 입력할 수 있습니다.' }
  }

  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    select: { status: true },
  })
  if (!assigned || !isAssignmentActive(assigned.status)) return { error: '배정되지 않은 심사입니다.' }

  const existingSub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    select: { status: true },
  })
  if (!canEvaluatorEdit(existingSub?.status ?? null)) {
    return { error: '이미 제출/승인되어 수정할 수 없습니다.' }
  }

  // 평가항목은 과제(Project) 단위 공통 — 채점 단위(지표별/통합) 기준으로 저장
  const units = await scoringUnitsForScope(session.projectId ? { projectId: session.projectId } : { sessionId })

  for (const u of units) {
    const raw = formData.get(`c_${u.unitId}`)
    if (raw === null || raw === '') {
      if (intent === 'submit') return { error: `'${u.label}' 항목이 입력되지 않았습니다.` }
      continue // 임시저장: 비어 있으면 건너뜀
    }

    const value = Number(raw)
    if (!isValidScoreValue(value, u.maxScore)) {
      return { error: `'${u.label}'은 0~${u.maxScore} 범위로 입력하세요.` }
    }

    if (u.kind === 'criterion') {
      await prisma.score.upsert({
        where: { evaluatorId_subjectId_criterionId: { evaluatorId: user.id, subjectId, criterionId: u.unitId } },
        update: { value, grade: null, sessionId },
        create: { evaluatorId: user.id, subjectId, criterionId: u.unitId, sessionId, value, grade: null },
      })
    } else {
      await prisma.score.upsert({
        where: { evaluatorId_subjectId_subitemId: { evaluatorId: user.id, subjectId, subitemId: u.unitId } },
        update: { value, grade: null, sessionId },
        create: { evaluatorId: user.id, subjectId, subitemId: u.unitId, sessionId, value, grade: null },
      })
    }
  }

  // 종합의견 저장 — 위원장의 평가표에는 이 칸이 없다(대상별 화면에서 '통합의견'으로 작성).
  // 폼에 필드 자체가 없으면 건드리지 않는다. 그러지 않으면 위원장이 점수를 저장할 때마다
  // 빈 값으로 간주돼 이미 써 둔 의견이 지워진다.
  if (formData.has('comment')) {
    const comment = String(formData.get('comment') ?? '').trim()
    if (comment) {
      await prisma.opinion.upsert({
        where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
        update: { text: comment, sessionId },
        create: { evaluatorId: user.id, subjectId, sessionId, text: comment },
      })
    } else {
      await prisma.opinion.deleteMany({ where: { evaluatorId: user.id, subjectId } })
    }
  }

  if (intent === 'save') {
    revalidatePath(`/evaluate/${sessionId}/${subjectId}`)
    return { saved: true }
  }

  // 제출 서명(핸드사인) — 제출할 때마다 필수. 인쇄 평가표 '(인)' 자리에 표시된다.
  const signature = String(formData.get('signature') ?? '')
  if (!signature.startsWith('data:image/png;base64,') || signature.length > 300_000) {
    return { error: '제출 서명이 필요합니다. 제출 확인 창에서 서명해주세요.' }
  }

  // 제출: 제출완료 상태로 기록(재제출 시에도 SUBMITTED로 갱신, 서명도 갱신)
  await prisma.submission.upsert({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    update: { status: 'SUBMITTED', submittedAt: new Date(), signature },
    create: { sessionId, evaluatorId: user.id, subjectId, status: 'SUBMITTED', submittedAt: new Date(), signature },
  })

  // 제출 후: 같은 심사의 다음 평가대상으로 이동. 마지막이면 목록으로(제출 안내).
  const subjects = await prisma.subject.findMany({
    where: { sessionId },
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  })
  const idx = subjects.findIndex((s) => s.id === subjectId)
  const next = idx >= 0 ? subjects[idx + 1] : undefined
  if (next) {
    redirect(`/evaluate/${sessionId}/${next.id}`)
  }
  redirect(`/evaluate?submitted=${encodeURIComponent(subjects[idx]?.name ?? '')}`)
}
