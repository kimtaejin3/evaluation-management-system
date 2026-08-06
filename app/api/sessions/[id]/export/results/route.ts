import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'
import { prisma } from '@/lib/db'
import { criteriaScopeForSession, scoringUnitsForScope } from '@/lib/criteria-scope'
import { scoreUnitId } from '@/lib/criteria-units'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessSession } from '@/lib/authz'
import { computeFinalScores, rankSubjects, overallGrade } from '@/lib/scoring'
import { TOTAL_SCORE } from '@/lib/criteria'

// 집계 결과 → xlsx 다운로드(순위 / 기업명 / 최종점수 / 등급 / 선정). 집계는 승인(APPROVED)된 점수만.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  if (!(await canTokenAccessSession(token, id))) return new Response('Unauthorized', { status: 401 })

  const [session, subjects, units, scores, approvedSubs] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id }, select: { maxScore: true } }),
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } }),
    scoringUnitsForScope(await criteriaScopeForSession(id)),
    prisma.score.findMany({
      where: { sessionId: id },
      select: { evaluatorId: true, subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.submission.findMany({ where: { sessionId: id, status: 'APPROVED' }, select: { evaluatorId: true, subjectId: true } }),
  ])

  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`))
  const approvedScores = scores.filter((s) => approved.has(`${s.evaluatorId}:${s.subjectId}`))
  const finalScores = computeFinalScores(
    approvedScores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: scoreUnitId(s), value: s.value })),
    units.map((u) => ({ id: u.unitId, weight: u.weight })),
  )
  const ranked = rankSubjects(finalScores)
  const nameOf = new Map(subjects.map((s) => [s.id, s.name]))
  const maxTotal = session?.maxScore ?? TOTAL_SCORE

  const fmt = (n: number) => Number(n.toFixed(2))
  const rows: Record<string, string | number>[] = ranked.map((r) => ({
    순위: r.rank,
    기업명: nameOf.get(r.subjectId) ?? '',
    최종점수: fmt(r.finalScore),
    등급: overallGrade(r.finalScore, maxTotal),
    선정: r.rank === 1 ? '선정' : '',
  }))
  // 점수가 없어 순위에 들지 않은 대상은 뒤에 붙임
  const rankedIds = new Set(ranked.map((r) => r.subjectId))
  for (const s of subjects) {
    if (!rankedIds.has(s.id)) rows.push({ 순위: '', 기업명: s.name, 최종점수: 0, 등급: '-', 선정: '' })
  }

  const buf = await buildStyledSheet({ sheetName: '집계결과', columns: ['순위', '기업명', '최종점수', '등급', '선정'], rows })
  return xlsxResponse(buf, '집계결과.xlsx')
}
