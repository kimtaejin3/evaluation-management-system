'use client'

import { useActionState, useState } from 'react'
import { saveScores } from '@/app/evaluate/actions'
import type { GradeOption } from '@/lib/scoring'

export interface CriterionView {
  id: string
  name: string
  description: string | null
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  maxScore: number
  weight: number
  value: number | null
  options: GradeOption[] | null
  selectedIndex: number | null
}

const inputCls = 'mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function ScoreForm({
  sessionId,
  subjectId,
  criteria,
}: {
  sessionId: string
  subjectId: string
  criteria: CriterionView[]
}) {
  const [state, formAction] = useActionState(saveScores.bind(null, sessionId, subjectId), null)

  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const c of criteria) {
      o[c.id] = c.type === 'QUALITATIVE' ? (c.selectedIndex != null ? String(c.selectedIndex) : '') : c.value != null ? String(c.value) : ''
    }
    return o
  })
  const setVal = (id: string, v: string) => setVals((p) => ({ ...p, [id]: v }))

  // 항목별 가중 점수
  const contrib = (c: CriterionView): number | null => {
    const raw = vals[c.id]
    if (raw === '') return null
    if (c.type === 'QUALITATIVE') {
      const opt = c.options?.[Number(raw)]
      return opt ? opt.points * c.weight : null
    }
    const n = Number(raw)
    return Number.isFinite(n) ? n * c.weight : null
  }
  const total = criteria.reduce((s, c) => s + (contrib(c) ?? 0), 0)
  const maxTotal = criteria.reduce((s, c) => s + c.maxScore * c.weight, 0)

  return (
    <form action={formAction} className="space-y-4">
      {criteria.map((c) => {
        const ct = contrib(c)
        const sel = c.options?.[Number(vals[c.id])]
        return (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-800">{c.name}</div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.type === 'QUALITATIVE' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                {c.type === 'QUALITATIVE' ? '정성' : '정량'}
              </span>
            </div>
            <div className="text-xs text-slate-400">배점 {c.maxScore} · 가중치 {c.weight}</div>
            {c.description && <p className="mt-1 text-xs text-slate-400">{c.description}</p>}

            {c.type === 'QUALITATIVE' ? (
              <select
                name={`c_${c.id}`}
                value={vals[c.id]}
                onChange={(e) => setVal(c.id, e.target.value)}
                required
                className={`block ${inputCls}`}
              >
                <option value="" disabled>등급 선택</option>
                {(c.options ?? []).map((o, i) => (
                  <option key={i} value={String(i)}>
                    {o.label} ({o.points}점)
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={`c_${c.id}`}
                type="number"
                step="any"
                min={0}
                max={c.maxScore}
                value={vals[c.id]}
                onChange={(e) => setVal(c.id, e.target.value)}
                required
                placeholder={`0 ~ ${c.maxScore}`}
                className={`block w-40 ${inputCls}`}
              />
            )}

            {/* 계산 공식 */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span className="text-slate-400">가중 점수 =</span>
              {c.type === 'QUALITATIVE' ? (
                <span>등급 점수{sel ? ` ${sel.points}` : ''} × 가중치 {c.weight}</span>
              ) : (
                <span>입력 점수{vals[c.id] ? ` ${vals[c.id]}` : ''} × 가중치 {c.weight}</span>
              )}
              <span className="font-semibold text-slate-700">= {ct != null ? fmt(ct) : '–'} 점</span>
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm">
        <span className="font-medium text-slate-700">가중 합계 (잠정)</span>
        <span className="font-bold text-indigo-700">
          {fmt(total)} <span className="font-normal text-slate-400">/ {fmt(maxTotal)} 점</span>
        </span>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>
      )}
      <button className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">
        저장·제출
      </button>
    </form>
  )
}
