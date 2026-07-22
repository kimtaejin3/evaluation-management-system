import { logout } from '@/app/login/actions'
import { getCurrentUser } from '@/lib/session'
import BrandMark from '@/components/BrandMark'

export default async function EvaluateLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* 단일 상단 바 (사이드바 없음) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <BrandMark variant="solid" className="h-7 w-7" />
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-800">심사·평가</div>
            <div className="text-xs text-slate-400">평가위원</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span><span className="font-medium text-slate-700">{user?.name ?? '평가위원'}</span> 님 · 평가위원</span>
          <form action={logout}>
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:bg-slate-50">로그아웃</button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
