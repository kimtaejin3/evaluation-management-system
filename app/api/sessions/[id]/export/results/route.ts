import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
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

  const [session, subjects, criteria, scores, approvedSubs] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id }, select: { maxScore: true } }),
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } }),
    prisma.criterion.findMany({ where: { sessionId: id }, select: { id: true, weight: true } }),
    prisma.score.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, criterionId: true, value: true } }),
    prisma.submission.findMany({ where: { sessionId: id, status: 'APPROVED' }, select: { evaluatorId: true, subjectId: true } }),
  ])

  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`))
  const approvedScores = scores.filter((s) => approved.has(`${s.evaluatorId}:${s.subjectId}`))
  const finalScores = computeFinalScores(
    approvedScores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })),
    criteria,
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

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 순위: '', 기업명: '', 최종점수: '', 등급: '', 선정: '' }])
  XLSX.utils.book_append_sheet(wb, ws, '집계결과')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('집계결과.xlsx')}`,
    },
  })
}
