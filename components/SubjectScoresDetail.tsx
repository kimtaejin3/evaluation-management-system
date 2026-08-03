'use client'

import { useEffect, useState } from 'react'

// 지원기업(평가 대상)별 위원 점수·종합의견 모달 — 평가 의견서 상세·사업 집계 결과 공용.
// 호출부가 evaluators를 어떤 기준(채점 완료/승인 제출)으로 거를지 정하고, 문구는 프롭으로 맞춘다.
export default function SubjectScoresDetail({
  subjectName,
  evaluators,
  buttonLabel = '자세히 보기',
  note = '채점을 완료한 위원의 총점과 종합의견입니다.',
  emptyMessage = '채점을 완료한 위원이 없습니다.',
  chairOpinion = false,
  chairOpinionOf = null,
}: {
  subjectName: string
  // groupComments가 있으면 '항목별 의견' 열을 함께 보여준다
  evaluators: {
    name: string
    isChair: boolean
    score: number
    opinion: string | null
    groupComments?: { groupName: string; text: string }[]
  }[]
  buttonLabel?: string
  note?: string
  emptyMessage?: string
  // true면 평가위원장 종합의견만 표시(위원별 점수 표 대신)
  chairOpinion?: boolean
  // 위원장 종합의견 — 위원장 본인의 채점 제출/승인 여부와 무관하게 작성되므로
  // evaluators(승인 제출만) 목록과 별개로 넘겨받는다. 없으면 evaluators에서 폴백.
  chairOpinionOf?: { name: string; text: string } | null
}) {
  const [open, setOpen] = useState(false)
  // 호출부가 groupComments를 넘겼을 때만 '항목별 의견' 열을 만든다
  const showGroupComments = evaluators.some((e) => e.groupComments !== undefined)
  const chairFromList = evaluators.find((e) => e.isChair)
  const chair =
    chairOpinionOf ?? (chairFromList?.opinion ? { name: chairFromList.name, text: chairFromList.opinion } : null)

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
        className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
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
                <h3 className="text-base font-semibold text-slate-800">
                  {subjectName} — {chairOpinion ? '평가위원장 종합의견' : '위원별 점수'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">{note}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
                ✕
              </button>
            </div>

            {chairOpinion ? (
              !chair ? (
                <p className="py-6 text-center text-sm text-slate-400">{emptyMessage}</p>
              ) : (
                <div>
                  <div className="mb-1.5 text-sm font-semibold text-slate-800">평가위원장({chair.name})</div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{chair.text}</p>
                </div>
              )
            ) : evaluators.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{emptyMessage}</p>
            ) : (
              <table className="table-grid w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-32 py-2 pr-4 font-medium">평가위원</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">점수</th>
                    <th className="px-3 py-2 font-medium">종합의견</th>
                    {showGroupComments && <th className="px-3 py-2 font-medium">항목별 의견</th>}
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
                      <td className="px-3 py-2 text-left text-slate-600">
                        {ev.opinion ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{ev.opinion}</p>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      {showGroupComments && (
                        <td className="px-3 py-2 text-left text-slate-600">
                          {ev.groupComments && ev.groupComments.length > 0 ? (
                            <ul className="space-y-1.5">
                              {ev.groupComments.map((gc, j) => (
                                <li key={j}>
                                  <div className="text-xs font-semibold text-slate-500">{gc.groupName}</div>
                                  <p className="whitespace-pre-wrap leading-relaxed">{gc.text}</p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )}
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
