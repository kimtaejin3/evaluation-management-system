'use client'

import { useState } from 'react'
import ResultCell from '@/components/ResultCell'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export interface RankSubject {
  id: string
  name: string
  // 점수 없는(검토 전) 대상은 null — 최종 점수를 '–'로 표시
  finalScore: number | null
  rank: number | null
}
export interface RankCriterion {
  id: string
  code: string
  name: string
  weight: number
}
export interface RankEvaluator {
  id: string
  name: string
}

export default function RankingTable({
  subjects,
  criteria,
  evaluators,
  scores,
  maxTotal,
}: {
  subjects: RankSubject[]
  criteria: RankCriterion[]
  evaluators: RankEvaluator[]
  scores: Record<string, number>
  maxTotal: number
}) {
  // '' = 전체(평균), 그 외 = 특정 위원 id
  const [view, setView] = useState<string>('')
  const isAll = view === ''

  const val = (evalId: string, subId: string, critId: string): number | null =>
    scores[`${evalId}:${subId}:${critId}`] ?? null
  const avg = (subId: string, critId: string): number | null => {
    const vs = evaluators.map((e) => val(e.id, subId, critId)).filter((v): v is number => v != null)
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  }
  const perEvaluator = (subId: string, critId: string) =>
    evaluators.map((e) => ({ name: e.name, value: val(e.id, subId, critId) }))
  // 위원의 이 기업 가중 합계(점수가 하나라도 있으면 합산, 없으면 null=미평가)
  const evalTotal = (evalId: string, subId: string): number | null => {
    let sum = 0
    let any = false
    for (const c of criteria) {
      const v = val(evalId, subId, c.id)
      if (v != null) {
        sum += v * c.weight
        any = true
      }
    }
    return any ? sum : null
  }

  // 선택 보기에 따른 행 값
  const cellValue = (subId: string, critId: string): number | null =>
    isAll ? avg(subId, critId) : val(view, subId, critId)
  const finalOf = (s: RankSubject): number | null => (isAll ? s.finalScore : evalTotal(view, s.id))

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print:overflow-visible print:rounded-none print:border-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 print:border-black">
        <span className="text-sm font-semibold text-slate-700">
          순위 결과
          <span className="ml-1 text-xs font-normal text-slate-400">
            {isAll ? '· 위원 평균 (셀에 마우스를 올리면 위원별 점수)' : `· ${evaluators.find((e) => e.id === view)?.name ?? ''} 위원 점수`}
          </span>
        </span>
        {/* 점수 보기 선택 — 전체(평균) 또는 위원별 */}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 print:hidden">
          점수 보기
          <select
            value={view}
            onChange={(e) => setView(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">전체 (평균)</option>
            {evaluators.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} 위원
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="w-full text-sm">
        <thead className="text-slate-500 print:text-black">
          <tr className="border-b border-slate-200 bg-slate-50 print:border-black print:bg-transparent">
            <th className="w-px whitespace-nowrap px-3 py-2 text-center font-medium print:border print:border-black">순위</th>
            <th className="px-3 py-2 text-left font-medium print:border print:border-black">기업</th>
            {/* 세부 항목 이름으로 표기(회의 결정) — 번호는 툴팁으로 유지 */}
            {criteria.map((c) => (
              <th
                key={c.id}
                className="max-w-28 px-2 py-2 text-center align-bottom text-xs font-medium break-keep whitespace-normal print:border print:border-black"
                title={c.code ? `${c.code} · ${c.name}` : c.name}
              >
                {c.name}
              </th>
            ))}
            <th className="w-px whitespace-nowrap px-4 py-2 text-right font-medium print:border print:border-black">
              최종<div className="text-xs font-normal text-slate-400 print:text-black">/{fmt(maxTotal)}</div>
            </th>

          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => {
            const fin = finalOf(s)
            return (
              <tr key={s.id} className="border-b border-slate-100 last:border-0 print:border-black">
                <td className="px-3 py-2.5 text-center print:border print:border-black">
                  {s.rank != null ? (
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 print:bg-transparent">{s.rank}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800 print:border print:border-black">{s.name}</td>
                {criteria.map((c) => (
                  <td key={c.id} className="px-3 py-2.5 text-center tabular-nums text-slate-700 print:border print:border-black">
                    {isAll ? (
                      <ResultCell avg={avg(s.id, c.id)} scores={perEvaluator(s.id, c.id)} />
                    ) : cellValue(s.id, c.id) != null ? (
                      fmt(cellValue(s.id, c.id) as number)
                    ) : (
                      <span className="text-slate-300">–</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right text-base font-bold text-slate-900 tabular-nums print:border print:border-black">
                  {fin != null ? fin.toFixed(2) : <span className="text-slate-300">–</span>}
                </td>

              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
