'use client'

import { useActionState } from 'react'
import { saveScores } from '@/app/evaluate/actions'

export interface CriterionView {
  id: string
  name: string
  description: string | null
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  maxScore: number
  weight: number
  value: number | null
  grade: string | null
}

const inputCls = 'mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default function ScoreForm({
  sessionId,
  subjectId,
  criteria,
  gradeRatios,
}: {
  sessionId: string
  subjectId: string
  criteria: CriterionView[]
  gradeRatios: Record<string, number>
}) {
  const [state, formAction] = useActionState(saveScores.bind(null, sessionId, subjectId), null)
  const grades = Object.keys(gradeRatios)

  return (
    <form action={formAction} className="space-y-4">
      {criteria.map((c) => (
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
            <select name={`c_${c.id}`} defaultValue={c.grade ?? ''} required className={`block ${inputCls}`}>
              <option value="" disabled>등급 선택</option>
              {grades.map((g) => (
                <option key={g} value={g}>{g} ({Math.round(gradeRatios[g] * 100)}%)</option>
              ))}
            </select>
          ) : (
            <input
              name={`c_${c.id}`}
              type="number"
              step="any"
              min={0}
              max={c.maxScore}
              defaultValue={c.value ?? ''}
              required
              placeholder={`0 ~ ${c.maxScore}`}
              className={`block w-40 ${inputCls}`}
            />
          )}
        </div>
      ))}
      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>
      )}
      <button className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">
        저장·제출
      </button>
    </form>
  )
}
