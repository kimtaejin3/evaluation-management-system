import AppShell from '@/components/AppShell'
import { logout } from '@/app/login/actions'
import { getCurrentUser } from '@/lib/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <AppShell
      subtitle="관리자 콘솔"
      nav={[
        { href: '/admin', label: '대시보드', exact: true },
        { href: '/admin/sessions/new', label: '새 회차' },
      ]}
      user={{ name: user?.name ?? '관리자', role: '관리자' }}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  )
}
