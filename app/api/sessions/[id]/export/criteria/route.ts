import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessSession } from '@/lib/authz'
import { criteriaScopeForSession } from '@/lib/criteria-scope'
import { buildCriteriaWorkbook } from '@/lib/criteria-export'

// 평가 항목 → xlsx 다운로드(평가항목/세부항목/평가지표/배점, group→subitem→criterion order 정렬)
// 평가항목은 사업(Project) 단위 공통 — 분과의 소속 사업 항목을 내려준다.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  if (!(await canTokenAccessSession(token, id))) return new Response('Unauthorized', { status: 401 })

  const groups = await prisma.criterionGroup.findMany({
    where: await criteriaScopeForSession(id),
    orderBy: { order: 'asc' },
    include: {
      subitems: {
        orderBy: { order: 'asc' },
        include: {
          criteria: {
            orderBy: { order: 'asc' },
            select: { name: true, maxScore: true },
          },
        },
      },
    },
  })

  const buf = await buildCriteriaWorkbook(groups)

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가항목.xlsx')}`,
    },
  })
}
