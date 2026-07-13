import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessSession } from '@/lib/authz'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

// 평가 대상 → xlsx 다운로드(기업명/지역/연구책임자/사업자번호/상태)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  if (!(await canTokenAccessSession(token, id))) return new Response('Unauthorized', { status: 401 })

  const subjects = await prisma.subject.findMany({
    where: { sessionId: id },
    orderBy: { order: 'asc' },
    include: { company: true },
  })

  const rows = subjects.map((s) => ({
    기업명: s.company.name,
    지역: s.company.region ?? '',
    연구책임자: s.company.leadResearcher ?? '',
    사업자번호: s.company.businessNo ?? '',
    상태: STATUS_LABEL[s.status] ?? s.status,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, '평가대상')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가대상.xlsx')}`,
    },
  })
}
