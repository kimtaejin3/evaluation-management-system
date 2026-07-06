import { prisma } from '@/lib/db'
import { computeFinalScores, rankSubjects } from '@/lib/scoring'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessSession } from '@/lib/authz'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  // 간사는 자기 분과만(마스터 전부, 평가위원 불가)
  if (!(await canTokenAccessSession(token, id))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const subjects = await prisma.subject.findMany({ where: { sessionId: id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id } })
  const scores = await prisma.score.findMany({ where: { sessionId: id } })
  const approvedSubs = await prisma.submission.findMany({ where: { sessionId: id, status: 'APPROVED' }, select: { evaluatorId: true, subjectId: true } })

  // 집계는 승인분만
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`))
  const approvedScores = scores.filter((s) => approved.has(`${s.evaluatorId}:${s.subjectId}`))

  const finalScores = computeFinalScores(
    approvedScores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })),
    criteria.map((c) => ({ id: c.id, weight: c.weight })),
  )
  const ranked = rankSubjects(finalScores)
  const nameById = new Map(subjects.map((s) => [s.id, s.name]))

  const rows = [
    ['순위', '대상', '최종점수'],
    ...ranked.map((r) => [String(r.rank), nameById.get(r.subjectId) ?? '', r.finalScore.toFixed(2)]),
  ]
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="results-${id}.csv"`,
    },
  })
}
