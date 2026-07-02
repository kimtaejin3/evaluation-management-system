'use client'

import { Fragment, useState } from 'react'

export interface PreviewCriterion {
  id: string
  groupName: string
  subitemName: string
  name: string
  maxScore: number
}

// 평가 대상 목록에서 평가항목별 세부항목·평가지표를 접었다 폈다(아코디언) 조회
export default function CriteriaAccordion({ criteria }: { criteria: PreviewCriterion[] }) {
  const [open, setOpen] = useState(false)

  // 평가항목(대분류) → 세부항목(중분류) 그룹 + 번호(1-1-1) — criteria는 이미 정렬되어 옴
  type Item = { c: PreviewCriterion; code: string }
  type SubGroup = { name: string; items: Item[] }
  const groups: { no: number; name: string; subgroups: SubGroup[] }[] = []
  criteria.forEach((c) => {
    let g = groups.find((x) => x.name === c.groupName)
    if (!g) { g = { no: groups.length + 1, name: c.groupName, subgroups: [] }; groups.push(g) }
    let sg = g.subgroups.find((x) => x.name === c.subitemName)
    if (!sg) { sg = { name: c.subitemName, items: [] }; g.subgroups.push(sg) }
    sg.items.push({ c, code: `${g.no}-${g.subgroups.length}-${sg.items.length + 1}` })
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
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.no}>
                    <tr className="bg-slate-50/70">
                      <td colSpan={3} className="px-4 py-1.5">
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{g.no}</span>
                        <span className="ml-1.5 text-xs font-semibold text-slate-600">{g.name}</span>
                      </td>
                    </tr>
                    {g.subgroups.map((sg, si) => (
                      <Fragment key={si}>
                        {sg.name && (
                          <tr>
                            <td colSpan={3} className="px-4 py-1">
                              <span className="ml-4 text-xs font-medium text-slate-500">
                                {g.no}-{si + 1}. {sg.name}
                              </span>
                            </td>
                          </tr>
                        )}
                        {sg.items.map(({ c, code }) => (
                          <tr key={c.id} className="border-b border-slate-100 align-top last:border-0">
                            <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-indigo-600">{code}</td>
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-slate-800">{c.name}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-800">{c.maxScore}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
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
