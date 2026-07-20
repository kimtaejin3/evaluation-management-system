'use client'

import { useEffect, useState } from 'react'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

type Item = { name: string; maxScore: number; value: number | null }

export default function ChairScoreCell({
  evaluatorName,
  subjectName,
  isChair = false,
  state,
  score,
  items,
  groupComments = [],
  opinion = null,
}: {
  evaluatorName: string
  subjectName: string
  isChair?: boolean
  state: 'done' | 'partial' | 'none'
  score: number | null
  items: Item[]
  // 평가항목(그룹)별 의견 — 작성된 것만
  groupComments?: { groupName: string; text: string }[]
  opinion?: string | null
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const doneCount = items.filter((i) => i.value != null).length
  const total = items.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded tabular-nums underline-offset-2 transition hover:underline"
        title="클릭하여 항목별 진행 보기"
      >
        {state === 'done' ? (
          <span className="font-semibold text-slate-800">{fmt(score!)}</span>
        ) : state === 'partial' ? (
          <span className="text-xs font-medium text-amber-600">입력중</span>
        ) : (
          <span className="text-xs text-slate-400">입력전</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{subjectName}</div>
                <div className="text-xs text-slate-500">
                  {evaluatorName} 위원{isChair && <span className="ml-1 text-indigo-600">(위원장)</span>}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <span>
                입력 진행 <span className="font-semibold text-slate-700">{doneCount}/{total}</span>
              </span>
              {state === 'done' && score != null && <span className="text-slate-400">· 합계 {fmt(score)}</span>}
              {state === 'none' && <span className="text-slate-400">· 입력 전</span>}
            </div>
            {/* 진행 막대 */}
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: total > 0 ? `${(doneCount / total) * 100}%` : '0%' }} />
            </div>

            <ul className="max-h-72 space-y-1 overflow-auto">
              {items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{it.name}</span>
                  {it.value != null ? (
                    <span className="shrink-0 tabular-nums text-slate-800">
                      <span className="font-semibold">{fmt(it.value)}</span>
                      <span className="text-xs text-slate-400"> / {it.maxScore}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-rose-500">미입력</span>
                  )}
                </li>
              ))}
              {total === 0 && <li className="px-1 text-xs text-slate-400">평가 항목이 없습니다.</li>}
            </ul>

            {/* 평가항목(그룹)별 의견 */}
            {groupComments.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-1 text-xs font-medium text-slate-500">평가항목별 의견</div>
                <ul className="space-y-1.5">
                  {groupComments.map((gc, i) => (
                    <li key={i} className="rounded-md bg-slate-50 px-2.5 py-1.5">
                      <div className="text-xs font-medium text-slate-500">{gc.groupName}</div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{gc.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 위원 종합의견 */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="mb-1 text-xs font-medium text-slate-500">종합의견</div>
              {opinion && opinion.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{opinion}</p>
              ) : (
                <p className="text-xs text-slate-400">작성된 종합의견이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
