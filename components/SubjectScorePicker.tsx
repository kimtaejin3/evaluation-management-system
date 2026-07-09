'use client'

import { usePrintIframe } from './usePrintIframe'

// 기업(대상)별 위원 점수 인쇄 — 각 대상마다 버튼으로 모든 위원의 점수표를 인쇄.
export default function SubjectScorePicker({
  sessionId,
  subjects,
}: {
  sessionId: string
  subjects: { id: string; name: string }[]
}) {
  const { preparing, print } = usePrintIframe()

  if (subjects.length === 0) {
    return <p className="text-sm text-slate-400">평가 대상이 없습니다.</p>
  }

  return (
    <div className="space-y-3">
      {preparing && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/30">
          <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-lg">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" aria-hidden />
            <span className="text-sm text-slate-600">인쇄 준비 중…</span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => print(`/print/subject-scores?sessionId=${sessionId}&subjectId=all`)}
          disabled={preparing}
          className="rounded-md bg-[var(--gov-navy)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
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
              disabled={preparing}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
            >
              인쇄
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
