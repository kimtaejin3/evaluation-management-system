'use client'

import { useState } from 'react'
import { addCriterion, updateCriterion } from '@/app/admin/sessions/actions'
import { parseGradeOptions } from '@/lib/scoring'

const inputCls = 'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

const DEFAULT_OPTS = [
  { label: '매우 우수', points: 30 },
  { label: '우수', points: 24 },
  { label: '보통', points: 18 },
  { label: '미흡', points: 12 },
  { label: '매우 미흡', points: 6 },
]

type CriterionType = 'QUANTITATIVE' | 'QUALITATIVE'

export interface CriterionInit {
  id: string
  section: string | null
  name: string
  description: string | null
  type: CriterionType
  maxScore: number
  gradeOptions: unknown
}

export default function CriterionForm({
  sessionId,
  criterion,
  onDone,
}: {
  sessionId: string
  criterion?: CriterionInit
  onDone?: () => void
}) {
  const editing = !!criterion
  const [type, setType] = useState<CriterionType>(criterion?.type ?? 'QUANTITATIVE')
  const [opts, setOpts] = useState(
    criterion && criterion.type === 'QUALITATIVE'
      ? (parseGradeOptions(criterion.gradeOptions) ?? DEFAULT_OPTS)
      : DEFAULT_OPTS,
  )

  const setOpt = (i: number, key: 'label' | 'points', v: string) =>
    setOpts((p) => p.map((o, idx) => (idx === i ? { ...o, [key]: key === 'points' ? Number(v) : v } : o)))
  const addOpt = () => setOpts((p) => [...p, { label: '', points: 0 }])
  const removeOpt = (i: number) => setOpts((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p))

  const action = async (formData: FormData) => {
    if (editing) await updateCriterion(sessionId, criterion!.id, formData)
    else await addCriterion(sessionId, formData)
    onDone?.()
  }

  return (
    <form action={action} className="space-y-3">
      {!editing && <div className="text-sm font-semibold text-slate-700">새 세부항목</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1 text-xs text-slate-500">
          항목 (예: 사업계획 / 추진역량 / 기대효과)
          <input name="section" defaultValue={criterion?.section ?? ''} placeholder="예: 사업계획 / 추진역량 / 기대효과" className={inputCls} />
        </div>
        <input name="name" defaultValue={criterion?.name ?? ''} placeholder="세부항목명 (예: 사업 타당성)" required className={`col-span-2 ${inputCls}`} />
        <input name="description" defaultValue={criterion?.description ?? ''} placeholder="평가 관점 설명 (예: 시장성·수익모델·실현 가능성)" className={`col-span-2 ${inputCls}`} />
        <label className="col-span-2 flex flex-col gap-1 text-xs text-slate-500">
          평가 방식
          <select value={type} name="type" onChange={(e) => setType(e.target.value as CriterionType)} className={inputCls}>
            <option value="QUANTITATIVE">정량 (점수 직접 입력)</option>
            <option value="QUALITATIVE">정성 (등급 선택)</option>
          </select>
        </label>
      </div>

      {type === 'QUANTITATIVE' ? (
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          배점 (0 ~ 배점 사이 점수 입력)
          <input name="maxScore" type="number" step="any" defaultValue={criterion && criterion.type === 'QUANTITATIVE' ? criterion.maxScore : undefined} placeholder="예: 30" required className={`w-40 ${inputCls}`} />
        </label>
      ) : (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">등급(답) 정의 — 등급명과 점수</span>
            <span className="text-xs text-slate-400">배점 = 최고 점수 {Math.max(...opts.map((o) => o.points || 0))}</span>
          </div>
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input name="optLabel" value={o.label} onChange={(e) => setOpt(i, 'label', e.target.value)} placeholder="등급명 (예: 매우 우수)" className={`flex-1 ${inputCls}`} />
              <input name="optPoints" type="number" step="any" value={Number.isFinite(o.points) ? o.points : ''} onChange={(e) => setOpt(i, 'points', e.target.value)} placeholder="점수" className={`w-24 ${inputCls}`} />
              <button type="button" onClick={() => removeOpt(i)} className="shrink-0 rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-400 transition hover:bg-white hover:text-rose-500">✕</button>
            </div>
          ))}
          <button type="button" onClick={addOpt} className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 transition hover:bg-white">+ 등급 추가</button>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {editing && onDone && (
          <button type="button" onClick={onDone} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">취소</button>
        )}
        <button className={`rounded-md bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 ${editing ? 'px-5' : 'w-full'}`}>
          {editing ? '저장' : '+ 세부항목 추가'}
        </button>
      </div>
    </form>
  )
}
