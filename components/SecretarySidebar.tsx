'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const STATUS: Record<string, string> = { DRAFT: '초안', IN_PROGRESS: '진행중', CLOSED: '마감' }

export default function SecretarySidebar({ sessions }: { sessions: { id: string; name: string; status: string }[] }) {
  const pathname = usePathname()
  const m = pathname.match(/^\/secretary\/([^/]+)/)
  const activeId = m?.[1] ?? null

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-[var(--gov-navy)] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-sm font-bold leading-tight">간사 콘솔</div>
        <div className="text-[11px] text-slate-400">전 심사 조회 (읽기 전용)</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">심사 목록</div>
        {sessions.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">등록된 심사 없음</div>}
        {sessions.map((s) => {
          const active = s.id === activeId
          return (
            <Link
              key={s.id}
              href={`/secretary/${s.id}`}
              title={s.name}
              className={`block rounded-md px-3 py-2 text-sm transition ${active ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}
            >
              <span className="block truncate">{s.name}</span>
              <span className="text-[11px] text-slate-400">{STATUS[s.status] ?? s.status}</span>
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">심사·평가 종합관리시스템</div>
    </aside>
  )
}
