import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { assertSessionAccess } from '@/lib/authz'

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // 로그인·소유(간사=자기 분과)·마스터 권한 검증. 권한 없으면 notFound.
  const { session } = await assertSessionAccess(id)

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
