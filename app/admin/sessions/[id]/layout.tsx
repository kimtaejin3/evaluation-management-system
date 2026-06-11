import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import StatusBadge from '@/components/StatusBadge'
import TabLink from '@/components/TabLink'

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  if (!session) notFound()
  const base = `/admin/sessions/${id}`

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-600">← 대시보드</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <StatusBadge status={session.status} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200 print:hidden">
        <TabLink href={base} exact>상세</TabLink>
        <TabLink href={`${base}/criteria`}>평가 항목</TabLink>
        <TabLink href={`${base}/subjects`}>평가 대상</TabLink>
        <TabLink href={`${base}/evaluators`}>평가위원</TabLink>
        <TabLink href={`${base}/progress`}>진행 현황</TabLink>
        <TabLink href={`${base}/results`}>집계 결과</TabLink>
        <TabLink href={`${base}/breakdown`}>산출 근거</TabLink>
      </div>
      <div>{children}</div>
    </div>
  )
}
