'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isValidScoreValue, parseGradeOptions, defaultGradeOptions } from '@/lib/scoring'

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
// 빈 값이면 해당 점수를 삭제(진행 상태 되돌림). evaluate 경로는 revalidate하지 않음(키 입력마다 리렌더 방지).
export async function autoSaveScore(
  sessionId: string,
  subjectId: string,
  criterionId: string,
  raw: string,
): Promise<{ ok: boolean; cleared?: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }

  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.status !== 'IN_PROGRESS') return { ok: false, error: 'not-active' }

  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
  })
  if (!assigned) return { ok: false, error: 'not-assigned' }

  const c = await prisma.criterion.findUnique({ where: { id: criterionId } })
  if (!c || c.sessionId !== sessionId) return { ok: false, error: 'bad-criterion' }

  if (raw === '' || raw == null) {
    await prisma.score.deleteMany({ where: { evaluatorId: user.id, subjectId, criterionId } })
    return { ok: true, cleared: true }
  }

  let value: number
  let grade: string | null = null
  if (c.type === 'QUALITATIVE') {
    const options = parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)
    const opt = options[Number(raw)]
    if (!opt) return { ok: false, error: 'bad-grade' }
    grade = opt.label
    value = opt.points
  } else {
    value = Number(raw)
    if (!isValidScoreValue(value, c.maxScore)) return { ok: false, error: 'range' }
  }

  await prisma.score.upsert({
    where: { evaluatorId_subjectId_criterionId: { evaluatorId: user.id, subjectId, criterionId } },
    update: { value, grade, sessionId },
    create: { evaluatorId: user.id, subjectId, criterionId, sessionId, value, grade },
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
    return { error: '진행 중인 회차에서만 입력할 수 있습니다.' }
  }

  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
  })
  if (!assigned) return { error: '배정되지 않은 회차입니다.' }

  const criteria = await prisma.criterion.findMany({ where: { sessionId } })

  for (const c of criteria) {
    const raw = formData.get(`c_${c.id}`)
    if (raw === null || raw === '') {
      if (intent === 'submit') return { error: `'${c.name}' 항목이 입력되지 않았습니다.` }
      continue // 임시저장: 비어 있으면 건너뜀
    }

    let value: number
    let grade: string | null = null
    if (c.type === 'QUALITATIVE') {
      const options = parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)
      const opt = options[Number(raw)]
      if (!opt) {
        if (intent === 'submit') return { error: `'${c.name}' 등급을 선택하세요.` }
        continue
      }
      grade = opt.label
      value = opt.points
    } else {
      value = Number(raw)
      if (!isValidScoreValue(value, c.maxScore)) {
        return { error: `'${c.name}'은 0~${c.maxScore} 범위로 입력하세요.` }
      }
    }

    await prisma.score.upsert({
      where: { evaluatorId_subjectId_criterionId: { evaluatorId: user.id, subjectId, criterionId: c.id } },
      update: { value, grade, sessionId },
      create: { evaluatorId: user.id, subjectId, criterionId: c.id, sessionId, value, grade },
    })
  }

  // 종합의견 저장
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

  if (intent === 'save') {
    revalidatePath(`/evaluate/${sessionId}/${subjectId}`)
    return { saved: true }
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } })
  redirect(`/evaluate?submitted=${encodeURIComponent(subject?.name ?? '')}`)
}
