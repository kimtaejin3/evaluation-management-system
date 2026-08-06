import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'
import { fmtYmd } from '@/lib/dates'

// 분과 목록 → xlsx (분과명/평가 상태/평가 기간/대상 수/위원 수/담당자)
const STATUS_LABEL: Record<string, string> = { DRAFT: '준비중', IN_PROGRESS: '진행중', CLOSED: '마감' }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  if (!(await canTokenAccessProject(token, id))) return new Response('Unauthorized', { status: 401 })

  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      secretary: { select: { name: true } },
      _count: { select: { subjects: true, assignments: true } },
    },
  })

  const rows = sessions.map((s) => ({
    분과명: s.name,
    '평가 상태': STATUS_LABEL[s.status] ?? s.status,
    '평가 기간':
      s.startDate || s.endDate ? `${fmtYmd(s.startDate)} ~ ${fmtYmd(s.endDate)}` : s.eventDate ? fmtYmd(s.eventDate) : '미정',
    '평가 대상 수': s._count.subjects,
    '평가위원 수': s._count.assignments,
    '담당자': s.secretary?.name ?? '미배정',
  }))

  const buf = await buildStyledSheet({ sheetName: '분과 목록', columns: ['분과명', '평가 상태', '평가 기간', '평가 대상 수', '평가위원 수', '담당자'], rows })
  return xlsxResponse(buf, '분과 목록.xlsx')
}
