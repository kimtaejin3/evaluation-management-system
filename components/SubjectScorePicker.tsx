'use client'

import { usePrintPreview } from './usePrintPreview'

// 기업(대상)별 위원 점수 인쇄 — 각 대상마다 버튼으로 미리보기 → 인쇄.
export default function SubjectScorePicker({
  sessionId,
  subjects,
}: {
  sessionId: string
  subjects: { id: string; name: string }[]
}) {
  const { print, element } = usePrintPreview()

  if (subjects.length === 0) {
    return <p className="text-sm text-slate-400">평가 대상이 없습니다.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => print(`/print/subject-scores?sessionId=${sessionId}&subjectId=all`)}
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
              onClick={() => print(`/print/subject-scores?sessionId=${sessionId}&subjectId=${s.id}`)}
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
