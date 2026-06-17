'use client'

import { useEffect, useState } from 'react'
import { parseGradeOptions, defaultGradeOptions } from '@/lib/scoring'

export interface PreviewCriterion {
  id: string
  section: string | null
  name: string
  description: string | null
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  maxScore: number
  gradeOptions: unknown
}

// 평가 대상 목록에서 해당 심사의 평가 항목을 바로 조회(읽기 전용 모달)
export default function CriteriaPreviewButton({
  sessionName,
  criteria,
}: {
  sessionName: string
  criteria: PreviewCriterion[]
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // 항목(섹션)별 그룹 + 번호(1 / 1-1)
  const sections: { no: number; name: string | null; items: { c: PreviewCriterion; code: string }[] }[] = []
  criteria.forEach((c) => {
    const key = c.section || null
    let g = sections.find((x) => x.name === key)
    if (!g) { g = { no: sections.length + 1, name: key, items: [] }; sections.push(g) }
    g.items.push({ c, code: `${g.no}-${g.items.length + 1}` })
  })
  const total = criteria.reduce((s, c) => s + c.maxScore, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/40 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/10"
      >
        평가 항목 보기
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h3 className="text-base font-semibold text-slate-800">평가 항목</h3>
                <p className="text-xs text-slate-500">{sessionName} · 전체 배점 {total}점</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="overflow-auto px-5 py-4">
              {sections.length === 0 && <p className="py-6 text-center text-sm text-slate-400">등록된 평가 항목이 없습니다.</p>}
              {sections.map((g) => (
                <div key={g.no} className="mb-4 last:mb-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded bg-[var(--gov-navy)] px-1.5 text-xs font-bold text-white">{g.no}</span>
                    <span className="text-sm font-semibold text-slate-800">{g.name ?? '평가 항목'}</span>
                  </div>
                  <ul className="space-y-2 border-l-2 border-slate-100 pl-3">
                    {g.items.map(({ c, code }) => {
                      const opts = c.type === 'QUALITATIVE' ? (parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)) : []
                      return (
                        <li key={c.id}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-slate-800">
                              <span className="mr-1.5 font-semibold text-indigo-600 tabular-nums">{code}</span>
                              {c.name}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">배점 {c.maxScore}</span>
                          </div>
                          {c.description && <p className="mt-0.5 text-xs text-slate-400">{c.description}</p>}
                          {c.type === 'QUALITATIVE' ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {opts.map((o, k) => (
                                <span key={k} className="inline-flex items-baseline gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px]">
                                  <span className="text-slate-600">{o.label}</span>
                                  <span className="text-slate-400 tabular-nums">{o.points}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-slate-400">정량 · 0 ~ {c.maxScore}점 직접 입력</p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
