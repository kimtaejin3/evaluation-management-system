'use client'

import { useState } from 'react'
import { usePrintPreview } from './usePrintPreview'

// 위원별 평가표 인쇄 — 위원을 드롭다운으로 고른 뒤, 각 기업(사업)별 버튼으로 해당 위원의 평가표를 인쇄.
export default function SheetPrintPicker({
  sessionId,
  evaluators,
  subjects,
}: {
  sessionId: string
  evaluators: { id: string; name: string }[]
  subjects: { id: string; name: string }[]
}) {
  const [evaluatorId, setEvaluatorId] = useState(evaluators[0]?.id ?? '')
  const { print: printUrl, element } = usePrintPreview()

  if (evaluators.length === 0) {
    return <p className="text-sm text-slate-400">배정된 위원이 없습니다.</p>
  }
  if (subjects.length === 0) {
    return <p className="text-sm text-slate-400">평가 대상이 없습니다.</p>
  }

  const print = (subjectId: string) =>
    printUrl(`/print/sheet?sessionId=${sessionId}&subjectId=${subjectId}&evaluatorId=${evaluatorId}`)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">평가위원</span>
          <select
            value={evaluatorId}
            onChange={(e) => setEvaluatorId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {evaluators.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => print('all')}
          className="rounded-md bg-[var(--gov-navy)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          전체 인쇄
        </button>
      </div>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
        {subjects.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-slate-700">{s.name}</span>
            <button
              type="button"
              onClick={() => print(s.id)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              인쇄
            </button>
          </div>
        ))}
      </div>

      {element}
    </div>
  )
}
