'use client'

import { Fragment, useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { saveScores, autoSaveScore, pingEditing, clearEditing } from '@/app/evaluate/actions'
import type { GradeOption } from '@/lib/scoring'
import DocPreviewBoard from '@/components/DocPreviewBoard'
import SubjectPicker from '@/components/SubjectPicker'

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
  isChair = false,
  eventDate,
  progress,
  documents,
  criteria,
  initialComment,
  subjects = [],
}: {
  sessionId: string
  subjectId: string
  subjectName: string
  sessionName: string
  evaluatorName: string
  isChair?: boolean
  eventDate: string | null
  progress: { done: number; total: number }
  documents: { id: string; name: string; mimeType: string }[]
  criteria: CriterionView[]
  initialComment: string
  subjects?: { id: string; name: string }[]
}) {
  const [state, formAction, isPending] = useActionState(saveScores.bind(null, sessionId, subjectId), null)
  const [confirm, setConfirm] = useState(false)
  const [comment, setComment] = useState(initialComment)
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const c of criteria) o[c.id] = c.type === 'QUALITATIVE' ? (c.selectedIndex != null ? String(c.selectedIndex) : '') : c.value != null ? String(c.value) : ''
    return o
  })

  // 자동 저장(디바운스)
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const runSave = async (criterionId: string, raw: string) => {
    setAutoState('saving')
    try {
      const res = await autoSaveScore(sessionId, subjectId, criterionId, raw)
      setAutoState(res?.ok ? 'saved' : 'error')
    } catch {
      setAutoState('error')
    }
  }
  const setVal = (id: string, v: string, immediate = false) => {
    setVals((p) => ({ ...p, [id]: v }))
    if (timers.current[id]) clearTimeout(timers.current[id])
    if (immediate) runSave(id, v)
    else timers.current[id] = setTimeout(() => runSave(id, v), 700)
  }

  // 입력 중(포커스) 추적
  const editingId = useRef<string | null>(null)
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null)
  const startEditing = (criterionId: string) => {
    editingId.current = criterionId
    void pingEditing(sessionId, subjectId, criterionId)
    if (heartbeat.current) clearInterval(heartbeat.current)
    heartbeat.current = setInterval(() => {
      if (editingId.current) void pingEditing(sessionId, subjectId, editingId.current)
    }, 4000)
  }
  const stopEditing = () => {
    editingId.current = null
    if (heartbeat.current) { clearInterval(heartbeat.current); heartbeat.current = null }
    void clearEditing()
  }
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void clearEditing() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      if (heartbeat.current) clearInterval(heartbeat.current)
      void clearEditing()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // 항목(섹션)별 그룹 + 번호 체계(1 / 1-1)
  type Item = { c: CriterionView; code: string }
  const sections: { no: number; name: string | null; items: Item[] }[] = []
  criteria.forEach((c) => {
    const key = c.section || null
    let g = sections.find((x) => x.name === key)
    if (!g) { g = { no: sections.length + 1, name: key, items: [] }; sections.push(g) }
    g.items.push({ c, code: `${g.no}-${g.items.length + 1}` })
  })
  const codeOf = new Map<string, string>()
  sections.forEach((g) => g.items.forEach((it) => codeOf.set(it.c.id, it.code)))
  const sectionDone = (g: (typeof sections)[number]) => g.items.filter((it) => vals[it.c.id] !== '').length

  // step: 섹션 인덱스 | 'summary'
  const [step, setStep] = useState<number | 'summary'>(0)
  const deadline = eventDate ? new Date(eventDate).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

  const navChip = (active: boolean, st: 'done' | 'partial' | 'none') =>
    `relative flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold transition ${
      active
        ? 'bg-[var(--gov-navy)] text-white'
        : st === 'done'
          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : st === 'partial'
            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
    }`

  return (
    <form action={formAction}>
      {/* 제출용 히든 값(전 항목) — 한 화면에 한 섹션만 보여도 모든 값이 제출됨 */}
      {criteria.map((c) => (
        <input key={c.id} type="hidden" name={`c_${c.id}`} value={vals[c.id]} />
      ))}

      {/* 헤더 (네비게이션) */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 pt-2.5 text-sm">
          <div className="flex items-center gap-2">
            <Link href="/evaluate" className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 transition hover:bg-slate-50">← 목록</Link>
            <span className="text-slate-500">{sessionName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span className={`h-1.5 w-1.5 rounded-full ${autoState === 'saving' ? 'bg-amber-500 animate-pulse' : autoState === 'error' ? 'bg-rose-500' : autoState === 'saved' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="text-slate-400">{autoState === 'saving' ? '저장 중' : autoState === 'error' ? '저장 실패' : '자동 저장'}</span>
            </span>
            <span className="text-sm">현재 <b className="text-indigo-700 tabular-nums">{fmt(total)}</b><span className="text-slate-400">/{fmt(maxTotal)}</span></span>
          </div>
        </div>
        {/* 네비: 회사 선택 · 위원장 배지 | 평가 항목 번호 · 총괄심사표 · (위원장) 다른 위원 평가 */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-6 py-2">
          {subjects.length > 0 ? (
            <SubjectPicker sessionId={sessionId} currentId={subjectId} subjects={subjects} />
          ) : (
            <span className="font-semibold text-slate-800">{subjectName}</span>
          )}
          {isChair && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">위원장</span>}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <span className="mr-1 text-xs font-medium text-slate-400">평가 항목</span>
          {sections.map((g, i) => {
            const d = sectionDone(g)
            const st: 'done' | 'partial' | 'none' = d >= g.items.length ? 'done' : d > 0 ? 'partial' : 'none'
            return (
              <button key={g.no} type="button" onClick={() => setStep(i)} className={navChip(step === i, st)} title={g.name ?? `항목 ${g.no}`}>
                {g.no}
              </button>
            )
          })}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button type="button" onClick={() => setStep('summary')} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${step === 'summary' ? 'bg-[var(--gov-navy)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            총괄심사표
          </button>
          {isChair && (
            <Link href={`/evaluate/${sessionId}/chair`} className="rounded-md bg-[var(--gov-navy)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90">
              다른 위원 평가 · 총평 →
            </Link>
          )}
          {deadline && <span className="ml-auto text-xs text-slate-400">마감 {deadline}</span>}
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
        {/* 심사 서류 */}
        <DocPreviewBoard documents={documents} />

        {step === 'summary' ? (
          /* ── 총괄심사표 (내 점수 전체 + 제출) ── */
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-700">총괄심사표 · {evaluatorName} 위원</h2>
                <span className="text-sm">합계 <b className="text-indigo-700 tabular-nums">{fmt(total)}</b> <span className="text-slate-400">/ {fmt(maxTotal)}</span></span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-px whitespace-nowrap px-3 py-2 text-center font-medium">번호</th>
                    <th className="px-3 py-2 font-medium">평가 항목</th>
                    <th className="w-px whitespace-nowrap px-3 py-2 text-right font-medium">배점</th>
                    <th className="w-px whitespace-nowrap px-3 py-2 text-right font-medium">내 점수</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((g) => (
                    <Fragment key={g.no}>
                      <tr>
                        <td colSpan={4} className="border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{g.no}</span>
                          <span className="ml-1.5 text-xs font-semibold text-slate-600">{g.name ?? '미분류'}</span>
                        </td>
                      </tr>
                      {g.items.map((it) => {
                        const ct = contrib(it.c)
                        return (
                          <tr key={it.c.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-3 py-2 text-center tabular-nums text-indigo-600">{it.code}</td>
                            <td className="px-3 py-2 text-slate-700">{it.c.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{it.c.maxScore}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{ct != null ? fmt(ct) : <span className="text-rose-500">미입력</span>}</td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 종합의견 */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">종합의견</span>
                <span className="text-xs text-slate-400">{comment.length} / 1000</span>
              </div>
              <textarea name="comment" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="대상에 대한 종합적인 평가 의견을 입력하세요. (선택)" className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => setComment((c) => (c ? `${c} ${q}` : q))} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600">{q}</button>
                ))}
              </div>
            </div>

            {state?.error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>}
            {state?.saved && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">임시 저장되었습니다.</p>}

            <div className="flex items-center justify-between gap-2">
              <button name="intent" value="save" disabled={isPending} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">임시 저장</button>
              <button type="button" onClick={() => setConfirm(true)} disabled={!allFilled || isPending} className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40">제출 전 확인 →</button>
            </div>
            {!allFilled && <p className="text-right text-xs text-slate-400">모든 항목을 입력하면 제출할 수 있습니다. ({filledCount}/{criteria.length})</p>}
          </>
        ) : (
          /* ── 항목 한 개 화면 ── */
          (() => {
            const g = sections[step] ?? sections[0]
            if (!g) return <p className="text-sm text-slate-400">평가 항목이 없습니다.</p>
            return (
              <>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-[var(--gov-navy)] px-1.5 text-sm font-bold text-white">{g.no}</span>
                  <h2 className="text-lg font-bold text-slate-900">{g.name ?? '평가 항목'}</h2>
                  <span className="text-xs text-slate-400">세부 {g.items.length}항목 · {sectionDone(g)}/{g.items.length} 입력</span>
                </div>

                {g.items.map((it) => {
                  const c = it.c
                  const ct = contrib(c)
                  return (
                    <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-indigo-600 tabular-nums">{it.code}</span>
                            <span className="font-semibold text-slate-800">{c.name}</span>
                          </div>
                          {c.description && <p className="mt-1 text-xs text-slate-400">{c.description}</p>}
                        </div>
                        <div className="shrink-0 text-right text-xs text-slate-400">배점 {c.maxScore}</div>
                      </div>

                      {c.type === 'QUALITATIVE' ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" onFocusCapture={() => startEditing(c.id)} onBlurCapture={stopEditing}>
                          {(c.options ?? []).map((o, idx) => {
                            const active = vals[c.id] === String(idx)
                            return (
                              <button key={idx} type="button" onClick={() => setVal(c.id, String(idx), true)} className={`flex flex-col items-center rounded-lg border px-2 py-3 text-sm transition ${active ? 'border-[var(--gov-navy)] bg-[var(--gov-navy)] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'}`}>
                                <span className="font-semibold">{o.label}</span>
                                <span className={`mt-0.5 text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>{o.points}점</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2">
                          <input type="number" step="any" min={0} max={c.maxScore} value={vals[c.id]} onChange={(e) => setVal(c.id, e.target.value)} onFocus={() => startEditing(c.id)} onBlur={stopEditing} placeholder={`0 ~ ${c.maxScore}`} className="w-40 rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          <span className="text-sm text-slate-400">/ {c.maxScore}점</span>
                        </div>
                      )}

                      <div className="mt-2.5 text-right text-xs text-slate-500">점수 <span className="font-semibold text-slate-700">{ct != null ? fmt(ct) : '–'}</span>점</div>
                    </div>
                  )
                })}

                {/* 이전 / 다음 */}
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setStep(step <= 0 ? 0 : step - 1)} disabled={step <= 0} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">← 이전 항목</button>
                  {step >= sections.length - 1 ? (
                    <button type="button" onClick={() => setStep('summary')} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">총괄심사표 →</button>
                  ) : (
                    <button type="button" onClick={() => setStep(step + 1)} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">다음 항목 →</button>
                  )}
                </div>
              </>
            )
          })()
        )}
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
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">취소 · 수정하기</button>
              <button name="intent" value="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">{isPending ? '제출 중…' : '평가 제출'}</button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
