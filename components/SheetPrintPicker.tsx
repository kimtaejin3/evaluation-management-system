'use client'

import { useState } from 'react'

// 위원별 평가표 인쇄 — 위원을 드롭다운으로 고른 뒤, 각 기업(과제)별 버튼으로 해당 위원의 평가표를 인쇄.
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

  if (evaluators.length === 0) {
    return <p className="text-sm text-slate-400">배정된 위원이 없습니다.</p>
  }
  if (subjects.length === 0) {
    return <p className="text-sm text-slate-400">평가 대상이 없습니다.</p>
  }

  // 페이지 이동 없이 숨김 iframe에 평가표(sheet)를 로드해 그 문서만 바로 인쇄.
  const print = (subjectId: string) => {
    const url = `/admin/sessions/${sessionId}/sheet?subjectId=${subjectId}&evaluatorId=${evaluatorId}`
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.left = '-9999px'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.onload = () => {
      const w = iframe.contentWindow
      if (!w) return
      const done = () => iframe.remove()
      w.addEventListener('afterprint', done, { once: true })
      w.focus()
      w.print()
      // afterprint 미발생(취소/미지원) 대비 폴백 정리
      setTimeout(done, 60_000)
    }
    iframe.src = url
    document.body.appendChild(iframe)
  }

  return (
    <div className="space-y-3">
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
    </div>
  )
}
