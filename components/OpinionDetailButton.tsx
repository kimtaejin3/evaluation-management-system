'use client'

import { useEffect, useState } from 'react'

// 평가 의견서 표의 '종합의견' / '항목별의견' 컬럼용 자세히 보기 버튼.
// mode에 따라 해당 의견만 위원별로 모아 모달로 보여준다. 내용 있는 위원이 없으면 '—'만 표시.
type Ev = {
  name: string
  isChair: boolean
  score: number
  text: string | null
  groupComments: { groupName: string; text: string }[]
}

export default function OpinionDetailButton({
  subjectName,
  mode,
  evaluators,
}: {
  subjectName: string
  mode: 'overall' | 'group'
  evaluators: Ev[]
}) {
  const [open, setOpen] = useState(false)
  const label = mode === 'overall' ? '종합의견' : '항목별 의견'
  const rows = evaluators.filter((e) => (mode === 'overall' ? !!e.text?.trim() : e.groupComments.length > 0))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (rows.length === 0) return <span className="text-slate-300">—</span>

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
      >
        자세히 보기 <span className="text-slate-400">({rows.length})</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-8 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                {subjectName} — {label}
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
                ✕
              </button>
            </div>

            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-32 py-2 pr-4 font-medium">평가위원</th>
                  {mode === 'overall' && <th className="w-20 px-3 py-2 text-right font-medium">점수</th>}
                  <th className="px-3 py-2 font-medium">{label}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev, i) => (
                  <tr key={i} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-4 text-slate-800">
                      {ev.name}
                      {ev.isChair && <span className="ml-1 text-xs text-indigo-500">(위원장)</span>}
                    </td>
                    {mode === 'overall' && (
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">{ev.score.toFixed(2)}</td>
                    )}
                    <td className="px-3 py-2 text-left text-slate-600">
                      {mode === 'overall' ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{ev.text}</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {ev.groupComments.map((gc, j) => (
                            <li key={j}>
                              <div className="text-xs font-semibold text-slate-500">{gc.groupName}</div>
                              <p className="whitespace-pre-wrap leading-relaxed">{gc.text}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
