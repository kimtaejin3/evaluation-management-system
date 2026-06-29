'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '초안', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  IN_PROGRESS: { label: '진행중', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  CLOSED: { label: '마감', cls: 'bg-slate-200 text-slate-600 ring-slate-300' },
}

type S = { id: string; name: string; status: string }

export default function SessionPicker({ sessions, currentId }: { sessions: S[]; currentId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = sessions.find((s) => s.id === currentId)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const select = (id: string) => {
    setOpen(false)
    if (id !== currentId) router.push(`/admin?session=${id}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group -ml-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-slate-100 focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[22rem] truncate text-lg font-bold text-slate-900">
          {current?.name ?? '분과 선택'}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1.5 max-h-80 w-80 overflow-auto rounded-lg border border-slate-200 bg-white py-1"
          role="listbox"
        >
          <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            분과 선택
          </div>
          {sessions.map((s) => {
            const active = s.id === currentId
            const st = STATUS[s.status] ?? { label: s.status, cls: 'bg-slate-100 text-slate-600 ring-slate-200' }
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(s.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                  active ? 'bg-indigo-50/60' : ''
                }`}
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 shrink-0 text-indigo-600 ${active ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden
                >
                  <path d="m4 10 4 4 8-9" />
                </svg>
                <span className={`flex-1 truncate ${active ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>
                  {s.name}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.cls}`}>
                  {st.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
