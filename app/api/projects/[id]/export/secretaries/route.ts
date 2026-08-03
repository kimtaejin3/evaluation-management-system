import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'

// 참여 담당자 → xlsx (이름/아이디/연락처/사번/담당 분과). 비밀번호는 내보내지 않는다.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  if (!(await canTokenAccessProject(token, id))) return new Response('Unauthorized', { status: 401 })

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      secretaries: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, username: true, phone: true, employeeNo: true },
      },
      sessions: { select: { name: true, secretaryId: true } },
    },
  })
  if (!project) return new Response('Not Found', { status: 404 })

  const sessionsOf = new Map<string, string[]>()
  for (const s of project.sessions) {
    if (!s.secretaryId) continue
    if (!sessionsOf.has(s.secretaryId)) sessionsOf.set(s.secretaryId, [])
    sessionsOf.get(s.secretaryId)!.push(s.name)
  }

  const rows = project.secretaries.map((u) => ({
    이름: u.name,
    아이디: u.username,
    연락처: u.phone ?? '',
    사번: u.employeeNo ?? '',
    '담당 분과': sessionsOf.get(u.id)?.join(', ') ?? '',
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows.length ? rows : [{ 이름: '', 아이디: '', 연락처: '', 사번: '', '담당 분과': '' }]),
    '참여 담당자',
  )
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('참여 담당자.xlsx')}`,
    },
  })
}
