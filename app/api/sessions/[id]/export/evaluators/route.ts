import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessSession } from '@/lib/authz'
import { assignmentStatusLabel, type AssignmentStatus } from '@/lib/assignment'

// 평가 위원 섭외 현황 → xlsx 다운로드(이름/아이디/연락처/상태)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  if (!(await canTokenAccessSession(token, id))) return new Response('Unauthorized', { status: 401 })

  const assignments = await prisma.assignment.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: 'asc' },
    include: { user: true },
  })

  const rows = assignments.map((a) => ({
    이름: a.user.name,
    아이디: a.user.username,
    연락처: a.user.phone ?? '',
    상태: assignmentStatusLabel(a.status as AssignmentStatus),
  }))

  const buf = await buildStyledSheet({ sheetName: '평가위원', columns: ['이름', '아이디', '연락처', '상태'], rows })
  return xlsxResponse(buf, '평가위원.xlsx')
}
