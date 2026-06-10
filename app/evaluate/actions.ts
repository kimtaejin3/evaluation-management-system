'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isValidScoreValue, gradeToValue } from '@/lib/scoring'

export async function saveScores(
  sessionId: string,
  subjectId: string,
  _prev: unknown,
  formData: FormData,
) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

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
    if (raw === null || raw === '') return { error: `'${c.name}' 항목이 입력되지 않았습니다.` }

    let value: number
    let grade: string | null = null
    if (c.type === 'QUALITATIVE') {
      grade = String(raw)
      value = gradeToValue(grade, c.maxScore)
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

  redirect('/evaluate')
}
