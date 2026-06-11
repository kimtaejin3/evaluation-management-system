import AppShell from '@/components/AppShell'
import { logout } from '@/app/login/actions'
import { getCurrentUser } from '@/lib/session'

export default async function EvaluateLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <AppShell
      subtitle="평가위원"
      nav={[{ href: '/evaluate', label: '평가 대상', exact: true }]}
      user={{ name: user?.name ?? '평가위원', role: '평가위원' }}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  )
}
