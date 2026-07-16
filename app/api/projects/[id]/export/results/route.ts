import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'
import { computeFinalScores, rankSubjects } from '@/lib/scoring'

// 집계 결과 → xlsx (분과/간사 제출/선정 결과/검토 상태)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  if (!(await canTokenAccessProject(token, id))) return new Response('Unauthorized', { status: 401 })

  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      status: true,
      submittedForReviewAt: true,
      secretary: { select: { name: true } },
    },
  })
  // 1위 — 분과 집계 결과와 동일 계산(승인 제출 점수 → computeFinalScores → rankSubjects)
  const sessionIds = sessions.map((s) => s.id)
  const [criteria, allScores, approvedSubs, subjects] = await Promise.all([
    prisma.criterion.findMany({ where: { projectId: id }, select: { id: true, weight: true } }),
    prisma.score.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, evaluatorId: true, subjectId: true, criterionId: true, value: true },
    }),
    prisma.submission.findMany({
      where: { sessionId: { in: sessionIds }, status: 'APPROVED' },
      select: { evaluatorId: true, subjectId: true },
    }),
    prisma.subject.findMany({ where: { sessionId: { in: sessionIds } }, select: { id: true, name: true } }),
  ])
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`))
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))

  const rows = sessions.map((s) => {
    const scoreRows = allScores.filter((sc) => sc.sessionId === s.id && approved.has(`${sc.evaluatorId}:${sc.subjectId}`))
    const top = rankSubjects(computeFinalScores(scoreRows, criteria)).find((r) => r.rank === 1)
    return {
      분과명: s.name,
      '담당 간사': s.secretary?.name ?? '미배정',
      '간사 제출': s.submittedForReviewAt ? '제출' : '미제출',
      '선정 결과': top ? (subjectName.get(top.subjectId) ?? '') : '',
      '검토 상태': s.status === 'CLOSED' ? '검토 완료' : s.submittedForReviewAt ? '대기' : '',
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '집계 결과')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('집계 결과.xlsx')}`,
    },
  })
}
