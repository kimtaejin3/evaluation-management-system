import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'
import { getSessionProgress } from '@/lib/progress'
import { fmtYmd } from '@/lib/dates'

// 평가 실시간 모니터링 → xlsx (분과별 진행 현황 스냅샷)
const STATUS_LABEL: Record<string, string> = { DRAFT: '준비중', IN_PROGRESS: '진행중', CLOSED: '마감' }

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
      startDate: true,
      endDate: true,
      eventDate: true,
      secretary: { select: { name: true } },
    },
  })
  const progress = await Promise.all(sessions.map((s) => getSessionProgress(s.id)))
  const opinionCounts = await prisma.opinion.groupBy({
    by: ['sessionId'],
    where: { sessionId: { in: sessions.map((s) => s.id) } },
    _count: { _all: true },
  })
  const opinionOf = new Map(opinionCounts.map((o) => [o.sessionId, o._count._all]))

  const rows = sessions.map((s, i) => {
    const p = progress[i]
    return {
      분과명: s.name,
      '평가 상태': STATUS_LABEL[s.status] ?? s.status,
      '평가 기간':
        s.startDate || s.endDate ? `${fmtYmd(s.startDate)} ~ ${fmtYmd(s.endDate)}` : s.eventDate ? fmtYmd(s.eventDate) : '미정',
      '담당자': s.secretary?.name ?? '미배정',
      '평가 대상 수': p.subjects.length,
      '평가위원 수': p.assignedCount,
      '완료 위원': `${p.completedEvaluators}/${p.assignedCount}`,
      '평가 의견서': `${opinionOf.get(s.id) ?? 0}/${p.assignedCount * p.subjects.length}`,
    }
  })

  const buf = await buildStyledSheet({ sheetName: '실시간 모니터링', columns: ['분과명', '평가 상태', '평가 기간', '담당자', '평가 대상 수', '평가위원 수', '완료 위원', '평가 의견서'], rows })
  return xlsxResponse(buf, '평가 실시간 모니터링.xlsx')
}
