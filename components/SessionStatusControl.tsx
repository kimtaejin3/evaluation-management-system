'use client'

import { useEffect, useState, useTransition } from 'react'
import { setSessionStatus } from '@/app/admin/sessions/actions'
import { canCloseSession } from '@/lib/session-rules'

type Status = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'

const MAP: Record<Status, { label: string; cls: string }> = {
  DRAFT: { label: '초안', cls: 'bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200' },
  IN_PROGRESS: { label: '진행중', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100' },
  CLOSED: { label: '마감', cls: 'bg-slate-200 text-slate-600 ring-slate-300 hover:bg-slate-300' },
}

const FLOW: { key: Status; label: string; desc: string }[] = [
  { key: 'DRAFT', label: '초안', desc: '항목·대상·위원을 설정합니다.' },
  { key: 'IN_PROGRESS', label: '진행중', desc: '평가위원이 점수를 입력합니다.' },
  { key: 'CLOSED', label: '마감', desc: '점수가 잠기고 결과가 확정됩니다.' },
]

export default function SessionStatusControl({
  sessionId,
  status,
  eventDate,
}: {
  sessionId: string
  status: Status
  eventDate: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ev = eventDate ? new Date(eventDate) : null
  const closable = canCloseSession(ev)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const badge = MAP[status]

  const change = (next: Status) => {
    startTransition(async () => {
      await setSessionStatus(sessionId, next)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition ${badge.cls}`}
        title="클릭하여 진행 상태 변경"
      >
        {badge.label}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-60" aria-hidden>
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">진행 상태 변경</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <ol className="mb-5 space-y-3">
              {FLOW.map((f) => {
                const current = status === f.key
                return (
                  <li key={f.key} className="flex gap-3">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${current ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>●</span>
                    <div>
                      <div className={`text-sm font-medium ${current ? 'text-indigo-600' : 'text-slate-600'}`}>{f.label}</div>
                      <div className="text-xs text-slate-400">{f.desc}</div>
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => change('IN_PROGRESS')}
                disabled={status !== 'DRAFT' || pending}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                평가 시작
              </button>
              <button
                type="button"
                onClick={() => change('CLOSED')}
                disabled={status !== 'IN_PROGRESS' || !closable || pending}
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                마감·잠금
              </button>
              {status === 'CLOSED' && (
                <button
                  type="button"
                  onClick={() => change('IN_PROGRESS')}
                  disabled={pending}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  마감 해제(진행중으로)
                </button>
              )}
              {status === 'IN_PROGRESS' && !closable && ev && (
                <p className="text-xs text-amber-600">평가 일시({ev.toLocaleDateString('ko-KR')}) 이후에 마감할 수 있습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
