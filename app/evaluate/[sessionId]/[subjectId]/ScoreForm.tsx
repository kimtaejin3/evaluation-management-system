'use client'

import { Fragment, useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import { saveScores, autoSaveScore } from '@/app/evaluate/actions'
import type { GradeOption } from '@/lib/scoring'
import DocPreviewBoard from '@/components/DocPreviewBoard'

export interface CriterionView {
  id: string
  section: string | null
  name: string
  description: string | null
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  maxScore: number
  weight: number
  value: number | null
  options: GradeOption[] | null
  selectedIndex: number | null
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const QUICK = ['전략 명확함', '리스크 우려', '조직 안정', '실적 우수', '보완 필요']

export default function ScoreForm({
  sessionId,
  subjectId,
  subjectName,
  sessionName,
  evaluatorName,
  eventDate,
  progress,
  documents,
  criteria,
  initialComment,
}: {
  sessionId: string
  subjectId: string
  subjectName: string
  sessionName: string
  evaluatorName: string
  eventDate: string | null
  progress: { done: number; total: number }
  documents: { id: string; name: string; mimeType: string }[]
  criteria: CriterionView[]
  initialComment: string
}) {
  const [state, formAction, isPending] = useActionState(saveScores.bind(null, sessionId, subjectId), null)
  const [confirm, setConfirm] = useState(false)
  const [comment, setComment] = useState(initialComment)
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const c of criteria) o[c.id] = c.type === 'QUALITATIVE' ? (c.selectedIndex != null ? String(c.selectedIndex) : '') : c.value != null ? String(c.value) : ''
    return o
  })

  // 자동 저장(디바운스) — 입력/선택 즉시 저장되어 진행 상태가 실시간 반영됨
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pending = useRef(0)

  const runSave = async (criterionId: string, raw: string) => {
    pending.current += 1
    setAutoState('saving')
    try {
      const res = await autoSaveScore(sessionId, subjectId, criterionId, raw)
      setAutoState(res?.ok ? 'saved' : 'error')
    } catch {
      setAutoState('error')
    } finally {
      pending.current -= 1
    }
  }

  const setVal = (id: string, v: string, immediate = false) => {
    setVals((p) => ({ ...p, [id]: v }))
    if (timers.current[id]) clearTimeout(timers.current[id])
    if (immediate) {
      runSave(id, v)
    } else {
      timers.current[id] = setTimeout(() => runSave(id, v), 700)
    }
  }

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
  const filledCount = criteria.filter((c) => vals[c.id] !== '').length
  const allFilled = filledCount === criteria.length && criteria.length > 0

  // 항목(섹션)별 그룹 — 전역 번호(i)는 유지
  const groups: { section: string | null; items: { c: CriterionView; i: number }[] }[] = []
  criteria.forEach((c, i) => {
    const key = c.section || null
    const last = groups[groups.length - 1]
    if (last && last.section === key) last.items.push({ c, i })
    else groups.push({ section: key, items: [{ c, i }] })
  })

  const deadline = eventDate
    ? new Date(eventDate).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <form action={formAction}>
      {/* 컨텍스트 줄: 뒤로 + 회차/위원 + 진행/마감 */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
          <div className="flex items-center gap-3">
            <Link href="/evaluate" className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 transition hover:bg-slate-50">← 대상 목록</Link>
            <span className="text-slate-400">{sessionName}</span>
            <span className="hidden text-slate-300 sm:inline">·</span>
            <span className="hidden text-slate-500 sm:inline">{evaluatorName} 위원</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">진행 <b className="text-slate-700">{progress.done}/{progress.total}</b></span>
            {deadline && <span className="text-slate-500">마감 <b className="text-slate-700">{deadline}</b></span>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
        {/* 대상 헤더 (현재 점수 sticky) */}
        <div className="sticky top-[3.25rem] z-10 -mx-6 flex items-end justify-between gap-3 border-b border-slate-200 bg-slate-100/95 px-6 py-3 backdrop-blur">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{subjectName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{sessionName} · 평가 입력</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 text-xs">
              <span className={`h-1.5 w-1.5 rounded-full ${autoState === 'saving' ? 'bg-amber-500 animate-pulse' : autoState === 'error' ? 'bg-rose-500' : autoState === 'saved' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="text-slate-400">
                {autoState === 'saving' ? '저장 중…' : autoState === 'error' ? '저장 실패' : autoState === 'saved' ? '자동 저장됨' : '현재 점수'}
              </span>
            </div>
            <div className="text-2xl font-bold text-indigo-700 tabular-nums">{fmt(total)}<span className="text-base font-normal text-slate-400"> / {fmt(maxTotal)}</span></div>
          </div>
        </div>

        {/* 심사 서류 — 여러 창 동시 프리뷰 */}
        <DocPreviewBoard documents={documents} />

        {/* 항목 입력 — 항목(섹션)별 그룹 */}
        {groups.map((g) => (
          <Fragment key={g.section}>
            {g.section && (
              <div className="flex items-center gap-2 px-1 pt-1">
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">항목</span>
                <h2 className="text-base font-bold text-slate-800">{g.section}</h2>
                <span className="text-xs text-slate-400">세부 {g.items.length}항목</span>
              </div>
            )}
            {g.items.map(({ c, i }) => {
          const ct = contrib(c)
          return (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-400">{i + 1}</span>
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.type === 'QUALITATIVE' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                      {c.type === 'QUALITATIVE' ? '정성' : '정량'}
                    </span>
                  </div>
                  {c.description && <p className="mt-1 text-xs text-slate-400">{c.description}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">배점 {c.maxScore}<br />가중치 {c.weight}</div>
              </div>

              {c.type === 'QUALITATIVE' ? (
                <>
                  <input type="hidden" name={`c_${c.id}`} value={vals[c.id]} />
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {(c.options ?? []).map((o, idx) => {
                      const active = vals[c.id] === String(idx)
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setVal(c.id, String(idx), true)}
                          className={`flex flex-col items-center rounded-lg border px-2 py-3 text-sm transition ${
                            active
                              ? 'border-[var(--gov-navy)] bg-[var(--gov-navy)] text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
                          }`}
                        >
                          <span className="font-semibold">{o.label}</span>
                          <span className={`mt-0.5 text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>{o.points}점</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    name={`c_${c.id}`}
                    type="number"
                    step="any"
                    min={0}
                    max={c.maxScore}
                    value={vals[c.id]}
                    onChange={(e) => setVal(c.id, e.target.value)}
                    placeholder={`0 ~ ${c.maxScore}`}
                    className="w-40 rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-400">/ {c.maxScore}점</span>
                </div>
              )}

              <div className="mt-2.5 text-right text-xs text-slate-500">
                가중 점수 <span className="font-semibold text-slate-700">{ct != null ? fmt(ct) : '–'}</span>점
              </div>
            </div>
          )
            })}
          </Fragment>
        ))}

        {/* 종합의견 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">종합의견</span>
            <span className="text-xs text-slate-400">{comment.length} / 1000</span>
          </div>
          <textarea
            name="comment"
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="대상에 대한 종합적인 평가 의견을 입력하세요. (선택)"
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setComment((c) => (c ? `${c} ${q}` : q))}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>
        )}
        {state?.saved && (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">임시 저장되었습니다.</p>
        )}

        {/* 하단 액션 */}
        <div className="flex items-center justify-between gap-2">
          <button name="intent" value="save" disabled={isPending} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            임시 저장
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={!allFilled || isPending}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            제출 전 확인 →
          </button>
        </div>
        {!allFilled && <p className="text-right text-xs text-slate-400">모든 항목을 입력하면 제출할 수 있습니다. ({filledCount}/{criteria.length})</p>}
      </div>

      {/* 제출 전 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
            <div className="text-xs text-slate-400">제출 확인 · 제출 후에는 관리자만 재오픈할 수 있습니다</div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{subjectName} 평가를 제출할까요?</h2>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-500">합계 점수</span>
                <span className="text-2xl font-bold text-indigo-700 tabular-nums">{fmt(total)} <span className="text-sm font-normal text-slate-400">/ {fmt(maxTotal)}</span></span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                {criteria.map((c) => {
                  const raw = vals[c.id]
                  const label = c.type === 'QUALITATIVE' ? (c.options?.[Number(raw)]?.label ?? '미선택') : raw === '' ? '미입력' : `${raw}점`
                  return <li key={c.id} className="flex justify-between"><span>{c.name}</span><span className="font-medium text-slate-600">{label}</span></li>
                })}
              </ul>
            </div>

            {comment.trim() && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-slate-500">종합의견</div>
                <p className="max-h-24 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{comment}</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                취소 · 수정하기
              </button>
              <button name="intent" value="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                {isPending ? '제출 중…' : '평가 제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
