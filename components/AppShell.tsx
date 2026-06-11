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
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col bg-[var(--gov-navy)] text-white">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-white/15 text-sm font-bold">심</span>
          <div>
            <div className="text-sm font-bold leading-tight">심사·평가</div>
            <div className="text-[11px] text-slate-400">{subtitle}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="px-2 pb-2">
            <div className="text-sm font-medium text-white">{user.name}</div>
            <div className="text-xs text-slate-400">{user.role}</div>
          </div>
          <form action={logoutAction}>
            <button className="w-full rounded-md border border-white/20 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10">
              로그아웃
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col overflow-x-auto">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-[var(--gov-navy)] text-[10px] font-bold text-white">정</span>
            <span>심사·평가 종합관리시스템</span>
          </div>
          <div className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{user.name}</span> 님 · {user.role}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
