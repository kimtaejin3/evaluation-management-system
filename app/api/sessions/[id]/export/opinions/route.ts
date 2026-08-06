import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessSession } from '@/lib/authz'
import { criteriaScopeForSession, scoringUnitsForScope } from '@/lib/criteria-scope'
import { buildOpinionsWorkbook } from '@/lib/opinions-export'

// 평가 의견서 → xlsx 다운로드. 위원 / 지원기업 / 종합의견 + 항목별의견(평가항목별). 위원장을 앞에.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  if (!(await canTokenAccessSession(token, id))) return new Response('Unauthorized', { status: 401 })

  const criteriaWhere = await criteriaScopeForSession(id)
  const [session, assignments, subjects, opinions, units, groupComments] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id }, select: { chairId: true } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: { select: { id: true, name: true } } } }),
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } }),
    prisma.opinion.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, text: true } }),
    scoringUnitsForScope(criteriaWhere),
    prisma.groupComment.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, groupId: true, text: true } }),
  ])
  const chairId = session?.chairId ?? null

  // 평가항목(대분류) 순서 — 채점 단위에서 유도(의견서 화면과 동일)
  const groups: { id: string; name: string }[] = []
  for (const u of units) if (!groups.some((g) => g.id === u.groupId)) groups.push({ id: u.groupId, name: u.groupName })

  const opinionOf = new Map<string, string>()
  for (const o of opinions) if (o.text.trim()) opinionOf.set(`${o.evaluatorId}:${o.subjectId}`, o.text)
  const groupCommentOf = new Map<string, string>()
  for (const gc of groupComments) if (gc.text.trim()) groupCommentOf.set(`${gc.evaluatorId}:${gc.subjectId}:${gc.groupId}`, gc.text)

  const evaluators = [...assignments]
    .sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))
    .map((a) => ({ id: a.userId, name: a.user.name, isChair: a.userId === chairId }))

  const buf = await buildOpinionsWorkbook({ evaluators, subjects, groups, opinionOf, groupCommentOf })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가의견서.xlsx')}`,
    },
  })
}
