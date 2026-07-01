import { prisma } from '@/lib/db'
import { computeFinalScores, rankSubjects } from '@/lib/scoring'
import { getCurrentToken } from '@/lib/session'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token || token.role === 'EVALUATOR') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const subjects = await prisma.subject.findMany({ where: { sessionId: id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id } })
  const scores = await prisma.score.findMany({ where: { sessionId: id } })

  const finalScores = computeFinalScores(
    scores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })),
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
