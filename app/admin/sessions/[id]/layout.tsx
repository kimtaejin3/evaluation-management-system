import SessionHeader from '@/components/SessionHeader'
import { assertSessionAccess } from '@/lib/authz'

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // 로그인·소유(담당자=자기 분과)·마스터 권한 검증. 권한 없으면 notFound.
  const { session } = await assertSessionAccess(id)

  return (
    <div className="space-y-6">
      <SessionHeader
        sessionId={session.id}
        sessionName={session.name}
        projectId={session.projectId}
      />
      <div>{children}</div>
    </div>
  )
}
