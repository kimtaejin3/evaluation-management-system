import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import StatusBadge from '@/components/StatusBadge'

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

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/admin/sessions" className="text-sm text-slate-400 hover:text-slate-600">← 분과 목록</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <StatusBadge status={session.status} />
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
