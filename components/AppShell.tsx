import NavLink from './NavLink'

export interface NavItem {
  href: string
  label: string
  exact?: boolean
}

export default function AppShell({
  subtitle,
  nav,
  user,
  logoutAction,
  children,
}: {
  subtitle: string
  nav: NavItem[]
  user: { name: string; role: string }
  logoutAction: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="text-lg font-bold tracking-tight">심사·평가 시스템</div>
          <div className="text-xs text-slate-400">{subtitle}</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="px-2 pb-2">
            <div className="text-sm font-medium text-slate-700">{user.name}</div>
            <div className="text-xs text-slate-400">{user.role}</div>
          </div>
          <form action={logoutAction}>
            <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              로그아웃
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 overflow-x-auto">
        <main className="mx-auto max-w-6xl p-8">{children}</main>
      </div>
    </div>
  )
}
