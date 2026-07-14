import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessSession } from '@/lib/authz'

// 평가 의견서 → xlsx 다운로드(위원 / 지원기업 / 종합의견). 위원장을 앞에.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  if (!(await canTokenAccessSession(token, id))) return new Response('Unauthorized', { status: 401 })

  const [session, assignments, subjects, opinions] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id }, select: { chairId: true } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: { select: { id: true, name: true } } } }),
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } }),
    prisma.opinion.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, text: true } }),
  ])
  const chairId = session?.chairId ?? null

  const opinionOf = new Map<string, string>()
  for (const o of opinions) if (o.text.trim()) opinionOf.set(`${o.evaluatorId}:${o.subjectId}`, o.text)

  const orderedEvaluators = [...assignments].sort(
    (a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0),
  )

  const rows: Record<string, string>[] = []
  for (const a of orderedEvaluators) {
    for (const s of subjects) {
      const text = opinionOf.get(`${a.userId}:${s.id}`)
      if (!text) continue
      rows.push({
        위원: a.user.name + (a.userId === chairId ? ' (위원장)' : ''),
        지원기업: s.name,
        종합의견: text,
      })
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 위원: '', 지원기업: '', 종합의견: '' }])
  XLSX.utils.book_append_sheet(wb, ws, '평가의견서')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가의견서.xlsx')}`,
    },
  })
}
