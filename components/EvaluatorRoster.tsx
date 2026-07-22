'use client'

import { useEffect, useState } from 'react'
import type { ProgressData } from '@/lib/progress'
import { PILL, statusLabel } from './MonitoringList'

type Evaluator = ProgressData['rows'][number]

// '평가 위원' KPI 옆 조회 버튼 — 배정 위원 전체의 정보(아이디·연락처)와 대상별 진행/제출 상태를 모달로 확인.
export default function EvaluatorRoster({
  evaluators,
  subjects,
}: {
  evaluators: Evaluator[]
  subjects: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (evaluators.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-indigo-300 hover:text-indigo-700"
      >
        조회
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="text-base font-semibold text-slate-800">평가 위원 <span className="text-slate-400">({evaluators.length}명)</span></div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <ul className="divide-y divide-slate-100 overflow-auto">
              {evaluators.map((ev) => (
                <li key={ev.userId} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{ev.name}</span>
                    {ev.isChair && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">위원장</span>}
                    <span className="text-xs text-slate-400">아이디 <span className="font-medium text-slate-600">{ev.username}</span></span>
                    <span className="text-xs text-slate-400">연락처 <span className="font-medium text-slate-600">{ev.phone ?? '미등록'}</span></span>
                    <span className="ml-auto text-xs text-slate-400">전체 입력 <span className="font-semibold text-slate-700">{ev.doneItems}/{ev.totalItems}</span></span>
                  </div>
                  {subjects.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {subjects.map((s, i) => {
                        const c = ev.cells[i]
                        return (
                          <span key={s.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[c.status]}`}>
                            <span className="max-w-[9rem] truncate">{s.name}</span>
                            <span className="opacity-70">{statusLabel(c.status)}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
