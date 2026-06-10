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
        <div key={c.id} className="rounded border p-4">
          <div className="font-medium">
            {c.name} <span className="text-sm text-gray-400">(배점 {c.maxScore} · 가중치 {c.weight})</span>
          </div>
          {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
          {c.type === 'QUALITATIVE' ? (
            <select name={`c_${c.id}`} defaultValue={c.grade ?? ''} required className="mt-2 rounded border px-3 py-2">
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
              className="mt-2 w-32 rounded border px-3 py-2"
            />
          )}
        </div>
      ))}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="rounded bg-gray-900 px-6 py-2 text-white">저장·제출</button>
    </form>
  )
}
