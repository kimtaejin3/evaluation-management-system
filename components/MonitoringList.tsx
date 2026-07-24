'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProgressData, Cell } from '@/lib/progress'
import { approveEvaluation, rejectEvaluation } from '@/app/admin/sessions/actions'
import { cellStatusLabel, type CellStatus } from '@/lib/submission'

// 기업(대상) 중심 리스트 — 각 대상의 입력/제출 진행 현황 조회.
// '자세히 보기'는 위원별 상태·진행 조회(모달). 위원 정보는 상단 '평가 위원' KPI의 조회 버튼에서.

export const PILL: Record<CellStatus, string> = {
  none: 'bg-slate-100 text-slate-500',
  partial: 'bg-amber-50 text-amber-700',
  entered: 'bg-indigo-50 text-indigo-700',
  submitted: 'bg-violet-50 text-violet-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
}
const isSubmitted = (st: CellStatus) => st === 'submitted' || st === 'approved'
// 제출완료(승인 전)는 '미승인'으로 표기
export const statusLabel = (st: CellStatus) => (st === 'submitted' ? '미승인' : cellStatusLabel(st))

type EvRow = { userId: string; name: string; isChair: boolean; cell: Cell }

export default function MonitoringList({ data, sessionId }: { data: ProgressData; sessionId: string }) {
  const { subjects, rows: evaluators } = data
  const [openId, setOpenId] = useState<string | null>(null)

  const evRowsAt = (si: number): EvRow[] =>
    evaluators.map((e) => ({ userId: e.userId, name: e.name, isChair: e.isChair, cell: e.cells[si] }))

  const openIdx = openId ? subjects.findIndex((s) => s.id === openId) : -1

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">기업별 평가 진행 현황</h2>
        <span className="text-xs text-slate-400">각 대상의 위원별 입력·제출 현황을 확인할 수 있습니다.</span>
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
            const submittedCount = rows.filter((r) => r.cell.status === 'submitted').length // 미승인
            const pct = total > 0 ? Math.round((inputCount / total) * 100) : 0
            const allDone = total > 0 && inputCount === total
            return (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
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
                    <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">입력 {inputCount}</span>
                  )}
                  {notInput > 0 && (
                    <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">미입력 {notInput}</span>
                  )}
                  {submittedCount > 0 && (
                    <span className="whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">미승인 {submittedCount}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(s.id)}
                  className="text-sm font-medium text-slate-600 transition hover:text-indigo-700 hover:underline"
                >
                  자세히 보기
                </button>
              </div>
            )
          })}
        </div>
      )}

      {openIdx >= 0 && (
        <SubjectDetailModal
          sessionId={sessionId}
          subjectId={subjects[openIdx].id}
          subjectName={subjects[openIdx].name}
          rows={evRowsAt(openIdx)}
          summary={{ done: evRowsAt(openIdx).filter((r) => isSubmitted(r.cell.status)).length, total: evaluators.length }}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  )
}

// ── 기업 상세(모달): 위원 · 상태 · 진행 + 항목 펼침 + 제출완료(미승인) 승인/반려 ──
function SubjectDetailModal({
  sessionId,
  subjectId,
  subjectName,
  rows,
  summary,
  onClose,
}: {
  sessionId: string
  subjectId: string
  subjectName: string
  rows: EvRow[]
  summary: { done: number; total: number }
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [pending, start] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const router = useRouter()

  const decide = (userId: string, approve: boolean) => {
    setBusyId(userId)
    start(async () => {
      if (approve) await approveEvaluation(sessionId, subjectId, userId)
      else await rejectEvaluation(sessionId, subjectId, userId)
      setBusyId(null)
      router.refresh()
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-800">{subjectName}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              제출 <span className="font-semibold text-slate-700">{summary.done}/{summary.total}</span> 위원
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="overflow-auto px-2 py-1">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="px-3 py-2 font-medium">위원</th>
                <th className="px-3 py-2 font-medium">진행</th>
                <th className="px-3 py-2 text-right font-medium">상태 · 승인</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = r.cell
                const isOpen = !!expanded[r.userId]
                return (
                  <Fragment key={r.userId}>
                    <tr className="border-t border-slate-50">
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-800">{r.name}</span>
                          {r.isChair && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">위원장</span>}
                          {c.total > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpanded((p) => ({ ...p, [r.userId]: !p[r.userId] }))}
                              className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-50"
                            >
                              항목 {isOpen ? '▴' : '▾'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-middle text-xs tabular-nums text-slate-400">{c.done}/{c.total}</td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PILL[c.status]}`}>
                            {statusLabel(c.status)}
                          </span>
                          {c.status === 'submitted' && (
                            <>
                              <button
                                type="button"
                                disabled={pending && busyId === r.userId}
                                onClick={() => decide(r.userId, true)}
                                className="rounded-md bg-[var(--gov-navy)] px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                              >
                                {pending && busyId === r.userId ? '처리 중…' : '승인'}
                              </button>
                              <button
                                type="button"
                                disabled={pending && busyId === r.userId}
                                onClick={() => decide(r.userId, false)}
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                반려
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={3} className="px-3 pb-2.5">
                          <ul className="space-y-0.5 rounded-lg bg-slate-50 p-2">
                            {c.items.length === 0 && <li className="px-1 text-xs text-slate-400">평가 항목이 없습니다.</li>}
                            {c.items.map((it) => (
                              <li key={it.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs font-bold ${it.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>{it.done ? '✓' : '·'}</span>
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
      </div>
    </div>
  )
}
