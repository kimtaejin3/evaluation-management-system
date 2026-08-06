import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'
import { buildCriteriaWorkbook } from '@/lib/criteria-export'

// 사업 공통 평가항목 → xlsx 다운로드(평가항목/세부항목/평가지표/배점, group→subitem→criterion order 정렬)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  if (!(await canTokenAccessProject(token, id))) return new Response('Unauthorized', { status: 401 })

  const groups = await prisma.criterionGroup.findMany({
    where: { projectId: id },
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
