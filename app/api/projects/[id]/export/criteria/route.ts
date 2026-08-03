import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { canTokenAccessProject } from '@/lib/authz'

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

  // 통합(퉁) 배점 세부항목은 배점을 첫 지표 행에만 1번 기재(지표는 설명)
  const rows = groups.flatMap((g) =>
    g.subitems.flatMap((sub) =>
      sub.criteria.length === 0
        ? sub.maxScore != null
          ? [{ 평가항목: g.name, 세부항목: sub.name, 평가지표: '', 배점: sub.maxScore as number | string }]
          : []
        : sub.criteria.map((c, i) => ({
            평가항목: g.name,
            세부항목: sub.name,
            평가지표: c.name,
            배점: sub.maxScore != null ? (i === 0 ? sub.maxScore : '') : c.maxScore,
          })),
    ),
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, '평가항목')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가항목.xlsx')}`,
    },
  })
}
