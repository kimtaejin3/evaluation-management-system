'use client'

import { useEffect, useState } from 'react'

// 지원기업(평가 대상)별 위원 점수·종합의견 모달 — 평가 의견서 상세·과제 집계 결과 공용.
// 호출부가 evaluators를 어떤 기준(채점 완료/승인 제출)으로 거를지 정하고, 문구는 프롭으로 맞춘다.
export default function SubjectScoresDetail({
  subjectName,
  evaluators,
  buttonLabel = '자세히 보기',
  note = '채점을 완료한 위원의 총점과 종합의견입니다.',
  emptyMessage = '채점을 완료한 위원이 없습니다.',
}: {
  subjectName: string
  evaluators: { name: string; isChair: boolean; score: number; opinion: string | null }[]
  buttonLabel?: string
  note?: string
  emptyMessage?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
      >
        {buttonLabel}
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
              <div>
                <h3 className="text-base font-semibold text-slate-800">{subjectName} — 위원별 점수</h3>
                <p className="mt-0.5 text-xs text-slate-400">{note}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
                ✕
              </button>
            </div>

            {evaluators.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{emptyMessage}</p>
            ) : (
              <table className="table-grid w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-32 py-2 pr-4 font-medium">평가위원</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">점수</th>
                    <th className="px-3 py-2 font-medium">종합의견</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluators.map((ev, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top last:border-0">
                      <td className="py-2 pr-4 text-slate-800">
                        {ev.name}
                        {ev.isChair && <span className="ml-1 text-xs text-indigo-500">(위원장)</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">{ev.score.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {ev.opinion ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{ev.opinion}</p>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  )
}
