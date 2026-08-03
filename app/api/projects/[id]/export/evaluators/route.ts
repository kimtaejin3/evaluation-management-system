import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'

// 평가위원 선정현황 → xlsx (분과/위원명/아이디/연락처).
// 화면과 동일 규칙: 마스터는 담당자 제출(SUBMITTED/APPROVED, 마감 포함) 후의 분과만,
// 담당자는 본인 담당 분과만 포함한다.
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
      chairId: true,
      secretaryId: true,
      evaluatorStatus: true,
      assignments: {
        orderBy: { createdAt: 'asc' },
        select: { userId: true, user: { select: { name: true, username: true, phone: true } } },
      },
    },
  })

  const visible = sessions.filter((s) =>
    token.role === 'MASTER'
      ? s.status === 'CLOSED' || s.evaluatorStatus === 'SUBMITTED' || s.evaluatorStatus === 'APPROVED'
      : s.secretaryId === token.userId,
  )

  const rows = visible.flatMap((s) =>
    s.assignments.map((a) => ({
      분과명: s.name,
      위원명: a.user.name + (a.userId === s.chairId ? ' (위원장)' : ''),
      아이디: a.user.username,
      연락처: a.user.phone ?? '',
    })),
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows.length ? rows : [{ 분과명: '', 위원명: '', 아이디: '', 연락처: '' }]),
    '평가위원 선정현황',
  )
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가위원 선정현황.xlsx')}`,
    },
  })
}
