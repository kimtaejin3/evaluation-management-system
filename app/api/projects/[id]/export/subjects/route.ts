import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'
import { computeWeightedScore } from '@/lib/scoring'
import { scoringUnitsForScope } from '@/lib/criteria-scope'
import { scoreUnitId } from '@/lib/criteria-units'

// 평가대상 → xlsx (분과/기업/개별 검토 상태/채점 완료 위원/평균 점수)
const SUBJECT_STATUS: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  if (!(await canTokenAccessProject(token, id))) return new Response('Unauthorized', { status: 401 })

  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  })
  const sessionIds = sessions.map((s) => s.id)
  const [units, subjects, assignments, scores] = await Promise.all([
    scoringUnitsForScope({ projectId: id }),
    prisma.subject.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, status: true, sessionId: true },
    }),
    prisma.assignment.findMany({ where: { sessionId: { in: sessionIds } }, select: { sessionId: true, userId: true } }),
    prisma.score.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { evaluatorId: true, subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
  ])
  const totalCriteria = units.length
  const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }))
  const scoreRows = new Map<string, { criterionId: string; value: number }[]>()
  for (const sc of scores) {
    const k = `${sc.evaluatorId}:${sc.subjectId}`
    if (!scoreRows.has(k)) scoreRows.set(k, [])
    scoreRows.get(k)!.push({ criterionId: scoreUnitId(sc), value: sc.value })
  }
  const sessionName = new Map(sessions.map((s) => [s.id, s.name]))

  const rows = subjects.map((sub) => {
    const evaluators = assignments.filter((a) => a.sessionId === sub.sessionId)
    const totals = evaluators
      .map((e) => {
        const r = scoreRows.get(`${e.userId}:${sub.id}`) ?? []
        return totalCriteria > 0 && r.length >= totalCriteria ? computeWeightedScore(r, weights) : null
      })
      .filter((v): v is number => v !== null)
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null
    return {
      분과명: sessionName.get(sub.sessionId) ?? '',
      기업명: sub.name,
      상태: SUBJECT_STATUS[sub.status] ?? sub.status,
      '채점 완료 위원': `${totals.length}/${evaluators.length}`,
      '평균 점수': avg !== null ? Number(avg.toFixed(2)) : '',
    }
  })

  const buf = await buildStyledSheet({ sheetName: '평가대상', columns: ['분과명', '기업명', '상태', '채점 완료 위원', '평균 점수'], rows })
  return xlsxResponse(buf, '평가대상.xlsx')
}
