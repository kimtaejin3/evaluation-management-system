'use client'

import { useState } from 'react'

// 행 = 채점 단위. 통합(퉁) 배점 세부항목은 1행이고 indicators에 설명용 지표들이 담긴다.
export interface PreviewCriterion {
  id: string
  groupName: string
  subitemName: string
  name: string
  indicators: string[]
  maxScore: number
}

type Sub = { name: string; items: PreviewCriterion[] }
type Group = { no: number; name: string; subs: Sub[] }

// 평가 대상 목록에서 3단계(평가항목 → 세부항목 → 평가지표)를 접었다 폈다(아코디언) 조회.
// 관리자 미리보기(CriteriaPreviewTable)와 동일한 4열 표로 통일.
export default function CriteriaAccordion({ criteria }: { criteria: PreviewCriterion[] }) {
  const [open, setOpen] = useState(false)

  // criteria는 group.order → subitem.order → criterion.order로 이미 정렬되어 옴
  const groups: Group[] = []
  criteria.forEach((c) => {
    let g = groups.find((x) => x.name === c.groupName)
    if (!g) {
      g = { no: groups.length + 1, name: c.groupName, subs: [] }
      groups.push(g)
    }
    let sg = g.subs.find((x) => x.name === c.subitemName)
    if (!sg) {
      sg = { name: c.subitemName, items: [] }
      g.subs.push(sg)
    }
    sg.items.push(c)
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
          <span className="text-xs font-normal text-slate-400">
            {criteria.length}개 · 배점 합계 {total}점
          </span>
        </span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open &&
        (criteria.length === 0 ? (
          <p className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-400">등록된 평가 항목이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 font-medium">평가항목</th>
                  <th className="px-4 py-2 font-medium">세부항목</th>
                  <th className="px-4 py-2 font-medium">평가지표</th>
                  <th className="w-px whitespace-nowrap px-4 py-2 text-right font-medium">배점</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const groupRowSpan = g.subs.reduce((n, s) => n + Math.max(1, s.items.length), 0) || 1
                  const gTotal = g.subs.reduce((n, s) => n + s.items.reduce((m, i) => m + i.maxScore, 0), 0)
                  const groupCell = (
                    <td rowSpan={groupRowSpan} className="border-r border-slate-100 px-4 py-3 align-top">
                      <span className="flex items-center gap-1.5">
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{g.no}</span>
                        <span className="font-semibold text-slate-800">{g.name}</span>
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-400">배점 {gTotal}</span>
                    </td>
                  )
                  let groupPlaced = false
                  return g.subs.map((sg) => {
                    const subRowSpan = Math.max(1, sg.items.length)
                    return sg.items.map((c, cIdx) => {
                      const cells: React.ReactNode[] = []
                      if (!groupPlaced) {
                        cells.push(<GroupCellSlot key="g">{groupCell}</GroupCellSlot>)
                        groupPlaced = true
                      }
                      if (cIdx === 0) {
                        cells.push(
                          <td key="s" rowSpan={subRowSpan} className="border-r border-slate-100 px-4 py-3 align-top text-slate-700">
                            {sg.name || <span className="text-slate-400">—</span>}
                          </td>,
                        )
                      }
                      cells.push(
                        <td key="c" className="px-4 py-3 text-slate-700">
                          {c.indicators.length > 0 ? (
                            /* 통합 배점 — 지표는 설명, 점수는 세부항목당 1개 */
                            <ul className="list-disc space-y-0.5 pl-4">
                              {c.indicators.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          ) : (
                            c.name
                          )}
                        </td>,
                        <td key="m" className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{c.maxScore}</td>,
                      )
                      return (
                        <tr key={c.id} className="border-b border-slate-100 last:border-0">
                          {cells}
                        </tr>
                      )
                    })
                  })
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  )
}

// groupCell(<td>)을 그대로 행에 배치하기 위한 통과용 래퍼(추가 DOM 없음)
function GroupCellSlot({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
