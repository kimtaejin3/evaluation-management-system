'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProgressData, Cell } from '@/lib/progress'
import { cellStatusLabel, type CellStatus } from '@/lib/submission'
import { approveEvaluation, rejectEvaluation } from '@/app/admin/sessions/actions'

// 기업(대상) 중심 리스트 — 각 기업의 위원 제출(N/M) 요약. '자세히 보기'로 그 자리에서(인라인)
// 위원별 상태·진행·승인/반려 컬럼을 펼쳐 보여준다(모달 아님). 위원 정보는 '조회'로 확인.

const PILL: Record<CellStatus, string> = {
  none: 'bg-slate-100 text-slate-500',
  partial: 'bg-amber-50 text-amber-700',
  entered: 'bg-indigo-50 text-indigo-700',
  submitted: 'bg-violet-50 text-violet-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
}
// 리스트 기준: 위원이 '제출'을 눌렀으면 입력(제출완료/승인), 아니면 미입력
const isSubmitted = (st: CellStatus) => st === 'submitted' || st === 'approved'
// 위원별 상태 라벨 — 제출완료(승인 전)는 '미승인'으로 표기
const statusLabel = (st: CellStatus) => (st === 'submitted' ? '미승인' : cellStatusLabel(st))

type EvaluatorRow = ProgressData['rows'][number]
type EvRow = { userId: string; name: string; isChair: boolean; cell: Cell }

export default function MonitoringList({ data, sessionId }: { data: ProgressData; sessionId: string }) {
  const { subjects, rows: evaluators } = data
  const router = useRouter()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [openItems, setOpenItems] = useState<Set<string>>(new Set()) // `${subjectId}:${userId}`
  const [infoUserId, setInfoUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // `${subjectId}:${userId}`
  const [confirm, setConfirm] = useState<{ subjectId: string; evaluatorId: string; evaluatorName: string; approve: boolean } | null>(null)

  const evRowsAt = (si: number): EvRow[] =>
    evaluators.map((e) => ({ userId: e.userId, name: e.name, isChair: e.isChair, cell: e.cells[si] }))

  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  }
  const infoEvaluator = infoUserId ? (evaluators.find((e) => e.userId === infoUserId) ?? null) : null

  const decide = async (subjectId: string, evaluatorId: string, approve: boolean) => {
    const key = `${subjectId}:${evaluatorId}`
    setBusy(key)
    try {
      if (approve) await approveEvaluation(sessionId, subjectId, evaluatorId)
      else await rejectEvaluation(sessionId, subjectId, evaluatorId)
      router.refresh()
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">기업별 평가 진행 현황</h2>
        <span className="text-xs text-slate-400">‘자세히 보기’로 위원별 상태·승인/반려·정보 조회를 확인하세요.</span>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">평가 대상이 없습니다.</div>
      ) : evaluators.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">배정·승인된 평가위원이 없습니다.</div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {subjects.map((s, si) => {
            const rows = evRowsAt(si)
            const total = rows.length
            const inputCount = rows.filter((r) => isSubmitted(r.cell.status)).length
            const notInput = total - inputCount
            const pct = total > 0 ? Math.round((inputCount / total) * 100) : 0
            const allDone = total > 0 && inputCount === total
            const open = openIds.has(s.id)
            return (
              <div key={s.id}>
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="w-48 shrink-0">
                    <span className="block truncate font-medium text-slate-800">{s.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${allDone ? 'bg-[var(--gov-navy)]' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-700">{inputCount}/{total}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                    {inputCount > 0 && (
                      <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">입력 {inputCount}</span>
                    )}
                    {notInput > 0 && (
                      <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">미입력 {notInput}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenIds((p) => toggle(p, s.id))}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
                  >
                    {open ? '접기' : '자세히 보기'}
                  </button>
                </div>

                {open && (
                  <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/40 px-4 py-2">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400">
                          <th className="px-3 py-2 font-medium">위원</th>
                          <th className="px-3 py-2 font-medium">상태</th>
                          <th className="px-3 py-2 font-medium">진행</th>
                          <th className="px-3 py-2 font-medium">승인/반려</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const c = r.cell
                          const itemKey = `${s.id}:${r.userId}`
                          const busyKey = `${c.subjectId}:${r.userId}`
                          const isItemsOpen = openItems.has(itemKey)
                          const decidable = c.status === 'submitted'
                          return (
                            <Fragment key={r.userId}>
                              <tr className="border-t border-slate-100">
                                <td className="px-3 py-2.5 align-middle">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium text-slate-800">{r.name}</span>
                                    {r.isChair && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">위원장</span>}
                                    <button
                                      type="button"
                                      onClick={() => setInfoUserId(r.userId)}
                                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-50"
                                    >
                                      조회
                                    </button>
                                    {c.total > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setOpenItems((p) => toggle(p, itemKey))}
                                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-50"
                                      >
                                        항목 {isItemsOpen ? '▴' : '▾'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 align-middle">
                                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PILL[c.status]}`}>{statusLabel(c.status)}</span>
                                </td>
                                <td className="px-3 py-2.5 align-middle text-xs tabular-nums text-slate-400">{c.done}/{c.total}</td>
                                <td className="px-3 py-2.5 align-middle">
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      disabled={!decidable || busy === busyKey}
                                      onClick={() => setConfirm({ subjectId: c.subjectId, evaluatorId: r.userId, evaluatorName: r.name, approve: false })}
                                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      반려
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!decidable || busy === busyKey}
                                      onClick={() => setConfirm({ subjectId: c.subjectId, evaluatorId: r.userId, evaluatorName: r.name, approve: true })}
                                      className="rounded-lg bg-[var(--gov-navy)] px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      승인
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {isItemsOpen && (
                                <tr>
                                  <td colSpan={4} className="px-3 pb-2.5">
                                    <ul className="space-y-0.5 rounded-lg bg-white p-2 ring-1 ring-slate-100">
                                      {c.items.length === 0 && <li className="px-1 text-xs text-slate-400">평가 항목이 없습니다.</li>}
                                      {c.items.map((it) => (
                                        <li key={it.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${it.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>{it.done ? '✓' : '·'}</span>
                                          <span className={`truncate ${it.done ? 'text-slate-700' : 'text-slate-400'}`}>{it.name}</span>
                                          <span className={`ml-auto shrink-0 text-xs ${it.done ? 'text-emerald-600' : 'text-slate-400'}`}>{it.done ? '입력완료' : '미입력'}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {infoEvaluator && (
        <EvaluatorInfoModal evaluator={infoEvaluator} subjects={subjects} onClose={() => setInfoUserId(null)} />
      )}

      {confirm && (
        <ConfirmDecideModal
          evaluatorName={confirm.evaluatorName}
          approve={confirm.approve}
          busy={busy === `${confirm.subjectId}:${confirm.evaluatorId}`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => decide(confirm.subjectId, confirm.evaluatorId, confirm.approve)}
        />
      )}
    </section>
  )
}

// ── 평가 위원 정보 조회 모달: 이름/아이디/연락처 + 대상별 진행·제출 상태 요약 ──
function EvaluatorInfoModal({
  evaluator,
  subjects,
  onClose,
}: {
  evaluator: EvaluatorRow
  subjects: { id: string; name: string }[]
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-base font-semibold text-slate-800">
              <span className="truncate">{evaluator.name}</span>
              {evaluator.isChair && <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">위원장</span>}
            </div>
            <dl className="mt-1.5 space-y-0.5 text-xs text-slate-500">
              <div className="flex gap-1.5">
                <dt className="shrink-0">아이디</dt>
                <dd className="font-medium text-slate-700">{evaluator.username}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0">연락처</dt>
                <dd className="font-medium text-slate-700">{evaluator.phone ?? '미등록'}</dd>
              </div>
            </dl>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          전체 항목 입력 <span className="font-semibold text-slate-700">{evaluator.doneItems}/{evaluator.totalItems}</span>
        </div>

        <ul className="divide-y divide-slate-50 overflow-auto px-2 py-1">
          {subjects.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-400">평가 대상이 없습니다.</li>}
          {subjects.map((s, i) => {
            const c = evaluator.cells[i]
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-700">{s.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[c.status]}`}>{statusLabel(c.status)}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400">{c.done}/{c.total}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ── 승인/반려 확인 모달 ──
function ConfirmDecideModal({
  evaluatorName,
  approve,
  busy,
  onConfirm,
  onCancel,
}: {
  evaluatorName: string
  approve: boolean
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-slate-800">{approve ? '승인' : '반려'} 확인</div>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">{evaluatorName}</span> 위원의 이 평가를 {approve ? '승인' : '반려'}하시겠습니까?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50">
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-50 ${approve ? 'bg-[var(--gov-navy)] hover:opacity-90' : 'bg-rose-600 hover:bg-rose-700'}`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
