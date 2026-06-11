import NavLink from './NavLink'
import BrandMark from './BrandMark'
import HeaderTitle from './HeaderTitle'

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
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-[var(--gov-navy)] text-white">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <BrandMark className="h-8 w-8" />
          <div>
            <div className="text-sm font-bold leading-tight">심사·평가</div>
            <div className="text-[11px] text-slate-400">{subtitle}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col overflow-x-auto">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3">
          <HeaderTitle />
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span><span className="font-medium text-slate-700">{user.name}</span> 님 · {user.role}</span>
            <form action={logoutAction}>
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:bg-slate-50">
                로그아웃
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
