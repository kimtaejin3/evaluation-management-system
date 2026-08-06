'use client'

import { useEffect, useState } from 'react'

type OpinionItem = { subjectName: string; text: string }

// 사업 평가의견서 표의 '자세히 보기' — 분과 페이지로 이동하지 않고 모달로 의견서를 보여준다.
// 내용은 분과 페이지와 동일하게 평가위원장이 작성한 종합의견만 표시한다.
export default function SessionOpinionsModal({
  sessionName,
  chairName,
  items,
}: {
  sessionName: string
  chairName: string | null
  items: OpinionItem[]
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
        className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
      >
        자세히 보기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        >
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">{sessionName}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {chairName ? `${chairName} 평가위원장 종합의견` : '평가위원장 종합의견'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-slate-400 transition hover:text-slate-600"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="overflow-auto px-6 py-4">
              {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  {chairName ? '작성된 종합의견이 없습니다.' : '평가위원장이 지정되지 않았습니다.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((it, i) => (
                    <li key={i} className="rounded-lg border border-slate-200 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-800">{it.subjectName}</div>
                      <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">{it.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
