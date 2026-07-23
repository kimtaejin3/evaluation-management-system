import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'

// 평가의견서 → xlsx (분과/위원/지원기업/종합의견).
// 화면과 동일 규칙: 마스터는 간사 검토 완료(SUBMITTED/APPROVED, 마감 포함) 후의 분과만,
// 간사는 본인 담당 분과만 포함한다.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  if (!(await canTokenAccessProject(token, id))) return new Response('Unauthorized', { status: 401 })

  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, status: true, chairId: true, secretaryId: true, opinionStatus: true },
  })
  const visible = sessions.filter((s) =>
    token.role === 'MASTER'
      ? s.status === 'CLOSED' || s.opinionStatus === 'SUBMITTED' || s.opinionStatus === 'APPROVED'
      : s.secretaryId === token.userId,
  )
  const sessionIds = visible.map((s) => s.id)
  const [assignments, subjects, opinions] = await Promise.all([
    prisma.assignment.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, userId: true, user: { select: { name: true } } },
    }),
    prisma.subject.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, sessionId: true },
    }),
    prisma.opinion.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, evaluatorId: true, subjectId: true, text: true },
    }),
  ])
  const nameOfEvaluator = new Map(assignments.map((a) => [`${a.sessionId}:${a.userId}`, a.user.name]))
  const nameOfSubject = new Map(subjects.map((s) => [s.id, s.name]))

  const rows = visible.flatMap((s) =>
    opinions
      .filter((o) => o.sessionId === s.id && o.text.trim())
      .map((o) => ({
        분과명: s.name,
        위원: (nameOfEvaluator.get(`${s.id}:${o.evaluatorId}`) ?? '') + (o.evaluatorId === s.chairId ? ' (위원장)' : ''),
        지원기업: nameOfSubject.get(o.subjectId) ?? '',
        종합의견: o.text,
      })),
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows.length ? rows : [{ 분과명: '', 위원: '', 지원기업: '', 종합의견: '' }]),
    '평가의견서',
  )
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가의견서.xlsx')}`,
    },
  })
}
