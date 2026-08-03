'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isValidScoreValue } from '@/lib/scoring'
import { canEvaluatorEdit } from '@/lib/submission'
import { isAssignmentActive } from '@/lib/assignment'
import { scoringUnitsForScope } from '@/lib/criteria-scope'
import { scoreUnitId } from '@/lib/criteria-units'

// 채점 단위(unitId) 해석 — 지표별 모드면 Criterion.id, 통합(퉁) 모드면 CriterionSubitem.id.
// 세션 소속(사업 공통/레거시 세션) 검증까지 수행하고, 저장에 쓸 컬럼과 만점을 돌려준다.
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
// 위원장의 종합의견 저장 — 위원장은 평가표 하단이 아니라 대상별 화면('위원장 종합의견')에서 쓴다.
// 저장 위치는 다른 위원과 같은 Opinion(위원×대상) 한 행이다.
// 의견서가 담당자 검토 제출(SUBMITTED)되거나 관리자 승인(APPROVED)된 뒤에는 수정·삭제할 수 없다.
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

  // 위원장의 종합의견 — 위원장은 평가표 대신 이 화면('위원장 종합의견')에서만 작성한다.
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

// 위원장 대상별 제출 — 종합의견 저장 + 본인 평가 제출(SUBMITTED). 종합의견 페이지에서 서명과 함께 확정.
// 전 항목 입력 + 종합의견 작성 + 서명이 있어야 하며, 이미 제출/승인이면 잠금.
export async function submitChairEvaluation(
  sessionId: string,
  subjectId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }
  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { chairId: true, status: true, projectId: true },
  })
  if (!session || session.chairId !== user.id) return { ok: false, error: '위원장만 제출할 수 있습니다.' }
  if (session.status !== 'IN_PROGRESS') return { ok: false, error: '진행 중인 심사에서만 제출할 수 있습니다.' }

  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    select: { status: true },
  })
  if (!assigned || !isAssignmentActive(assigned.status)) return { ok: false, error: '배정되지 않은 심사입니다.' }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { sessionId: true } })
  if (!subject || subject.sessionId !== sessionId) return { ok: false, error: '해당 분과의 평가 대상이 아닙니다.' }

  const existing = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    select: { status: true },
  })
  if (!canEvaluatorEdit(existing?.status ?? null)) return { ok: false, error: '이미 제출/승인되어 수정할 수 없습니다.' }

  const opinion = String(formData.get('opinion') ?? '').trim()
  if (!opinion) return { ok: false, error: '종합의견을 작성한 뒤 제출할 수 있습니다.' }
  const signature = String(formData.get('signature') ?? '')
  if (!signature.startsWith('data:image/png;base64,') || signature.length > 300_000) {
    return { ok: false, error: '제출 서명이 필요합니다. 서명란에 서명해주세요.' }
  }

  // 전 항목 입력 확인 — 위원장 본인 점수가 모든 채점 단위에 있어야 한다.
  const units = await scoringUnitsForScope(session.projectId ? { projectId: session.projectId } : { sessionId })
  const unitIds = new Set(units.map((u) => u.unitId))
  const scores = await prisma.score.findMany({
    where: { sessionId, evaluatorId: user.id, subjectId },
    select: { criterionId: true, subitemId: true },
  })
  const filled = new Set(scores.map((s) => scoreUnitId(s)).filter((id) => unitIds.has(id)))
  if (units.length === 0 || filled.size < units.length) {
    return { ok: false, error: '평가표에서 모든 항목을 입력한 뒤 제출할 수 있습니다.' }
  }

  // 종합의견 저장 + 제출(SUBMITTED, 서명)
  await prisma.opinion.upsert({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    update: { text: opinion, sessionId },
    create: { evaluatorId: user.id, subjectId, sessionId, text: opinion },
  })
  await prisma.submission.upsert({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    update: { status: 'SUBMITTED', submittedAt: new Date(), signature },
    create: { sessionId, evaluatorId: user.id, subjectId, status: 'SUBMITTED', submittedAt: new Date(), signature },
  })
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

  // 평가항목은 사업(Project) 단위 공통 — 소속 검증(레거시: 세션 항목)
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

  // 평가항목은 사업(Project) 단위 공통 — 채점 단위(지표별/통합) 기준으로 저장
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

  // 종합의견 저장 — 위원장의 평가표에는 이 칸이 없다(대상별 화면에서 '위원장 종합의견'으로 작성).
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

  // 위원장은 종합의견을 작성한 뒤에만 제출할 수 있다(항목표에서 종합의견 전 제출 방지).
  if (session.chairId === user.id) {
    const op = await prisma.opinion.findUnique({
      where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
      select: { text: true },
    })
    if (!op || !op.text.trim()) return { error: '종합의견을 작성한 뒤 제출할 수 있습니다.' }
  }

  // 제출: 제출완료 상태로 기록(재제출 시에도 SUBMITTED로 갱신, 서명도 갱신)
  await prisma.submission.upsert({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    update: { status: 'SUBMITTED', submittedAt: new Date(), signature },
    create: { sessionId, evaluatorId: user.id, subjectId, status: 'SUBMITTED', submittedAt: new Date(), signature },
  })

  // 위원장은 목록으로 튕기지 않고 이 평가표에 남는다 — 제출로 '위원별 평가·종합의견' 버튼이
  // 그 자리에서 활성화되도록 revalidate만 한다(제출 상태가 갱신되며 링크가 열림).
  if (session.chairId === user.id) {
    revalidatePath(`/evaluate/${sessionId}/${subjectId}`)
    return { submitted: true }
  }

  // 일반 위원: 제출 후 다음 대상으로 자동 이동하지 않고 목록으로 돌아간다(제출 안내).
  // 다음 대상은 위원이 목록에서 직접 고른다.
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } })
  redirect(`/evaluate?submitted=${encodeURIComponent(subject?.name ?? '')}`)
}

// 위원장 확인 — 위원장이 특정 위원의 평가(점수·종합의견)를 확인했음을 기록한다.
// 담당자·마스터의 승인(Submission.status)과는 별개이며 집계에는 영향을 주지 않는다.
export async function confirmEvaluation(
  sessionId: string,
  subjectId: string,
  evaluatorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }
  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { chairId: true, status: true },
  })
  if (!session || session.chairId !== user.id) return { ok: false, error: '위원장만 확인할 수 있습니다.' }
  if (session.status !== 'IN_PROGRESS') return { ok: false, error: '진행 중인 심사에서만 확인할 수 있습니다.' }
  if (evaluatorId === user.id) return { ok: false, error: '본인 평가는 확인 대상이 아닙니다.' }

  // 제출한 평가만 확인 대상 — 대상이 이 분과 소속인지도 함께 검증된다
  const sub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId, subjectId } },
    select: { sessionId: true, status: true, chairConfirmedAt: true },
  })
  if (!sub || sub.sessionId !== sessionId) return { ok: false, error: '해당 분과의 평가가 아닙니다.' }
  if (!(sub.status === 'SUBMITTED' || sub.status === 'APPROVED')) {
    return { ok: false, error: '아직 제출되지 않은 평가입니다.' }
  }
  if (sub.chairConfirmedAt) return { ok: true } // 이미 확인 — 멱등

  await prisma.submission.update({
    where: { evaluatorId_subjectId: { evaluatorId, subjectId } },
    data: { chairConfirmedAt: new Date(), chairConfirmedById: user.id },
  })
  revalidatePath(`/evaluate/${sessionId}/chair/${subjectId}`)
  return { ok: true }
}
