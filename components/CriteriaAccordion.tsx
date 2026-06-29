'use client'

import { Fragment, useState } from 'react'
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

// 평가 대상 목록에서 분과별 평가 항목을 접었다 폈다(아코디언) 조회
export default function CriteriaAccordion({ criteria }: { criteria: PreviewCriterion[] }) {
  const [open, setOpen] = useState(false)

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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          평가 항목
          <span className="text-xs font-normal text-slate-400">{criteria.length}개 · 배점 합계 {total}점</span>
        </span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open && (
        criteria.length === 0 ? (
          <p className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-400">등록된 평가 항목이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-px whitespace-nowrap px-4 py-2 text-center font-medium">번호</th>
                  <th className="px-4 py-2 font-medium">평가 항목</th>
                  <th className="w-px whitespace-nowrap px-4 py-2 text-right font-medium">배점</th>
                  <th className="px-4 py-2 font-medium">등급별 환산점수 (답)</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((g) => (
                  <Fragment key={g.no}>
                    <tr className="bg-slate-50/70">
                      <td colSpan={4} className="px-4 py-1.5">
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{g.no}</span>
                        <span className="ml-1.5 text-xs font-semibold text-slate-600">{g.name ?? '미분류'}</span>
                      </td>
                    </tr>
                    {g.items.map(({ c, code }) => {
                      const isQual = c.type === 'QUALITATIVE'
                      const opts = isQual ? (parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)) : []
                      return (
                        <tr key={c.id} className="border-b border-slate-100 align-top last:border-0">
                          <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-indigo-600">{code}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-800">{c.name}</div>
                            {c.description && <div className="mt-0.5 text-xs text-slate-400">{c.description}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-800">{c.maxScore}</td>
                          <td className="px-4 py-2.5">
                            {isQual ? (
                              <div className="flex flex-wrap gap-1.5">
                                {opts.map((o, k) => (
                                  <span key={k} className="inline-flex items-baseline gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                                    <span className="font-medium text-slate-700">{o.label}</span>
                                    <span className="text-slate-400 tabular-nums">{o.points}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">0 ~ {c.maxScore}점 직접 입력</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
