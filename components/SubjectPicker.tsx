'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// 점수 입력 화면 헤더의 평가 대상 전환 드롭다운
export default function SubjectPicker({
  sessionId,
  currentId,
  subjects,
  step,
  onSelect,
}: {
  sessionId: string
  currentId: string
  subjects: { id: string; name: string }[]
  step?: string
  // 있으면 라우트 이동 대신 이 콜백으로 전환(CSR 모드)
  onSelect?: (id: string) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = subjects.find((s) => s.id === currentId)

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
    if (id === currentId) return
    if (onSelect) {
      onSelect(id) // CSR: 라우트 이동 없이 클라이언트에서 전환
    } else {
      const q = step ? `?step=${encodeURIComponent(step)}` : ''
      router.push(`/evaluate/${sessionId}/${id}${q}`)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-slate-800 transition hover:bg-slate-100"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[12rem] truncate">{current?.name ?? '평가 대상'}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-80 w-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="listbox">
          <div className="px-3 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">평가 대상 전환</div>
          {subjects.map((s, i) => {
            const active = s.id === currentId
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(s.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${active ? 'bg-indigo-50/60' : ''}`}
              >
                <span className="w-5 shrink-0 text-xs text-slate-400 tabular-nums">{i + 1}</span>
                <span className={`flex-1 truncate ${active ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>{s.name}</span>
                {active && <span className="text-xs text-indigo-600">현재</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
