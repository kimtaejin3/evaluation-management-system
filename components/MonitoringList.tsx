'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProgressData, Cell } from '@/lib/progress'
import { cellStatusLabel, type CellStatus } from '@/lib/submission'
import { approveEvaluation, rejectEvaluation } from '@/app/admin/sessions/actions'

// 기업(대상) 중심 리스트 — 각 기업의 위원 제출(N/M) + 입력/미입력 요약, '자세히 보기'로 위원별 상세 모달.
// 리스트에서 바로 보이는 상태는 입력/미입력만(제출 눌렀으면 입력). 승인·반려 등 결재 상태는 모달에서만.

// 위원별 상세(모달)용 — 제출/승인/반려까지 포함한 전체 상태 색
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

// 모달 위원별 상태 라벨 — 제출완료(승인 전)는 '미승인'으로 표기
const statusLabel = (st: CellStatus) => (st === 'submitted' ? '미승인' : cellStatusLabel(st))

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
        <span className="text-xs text-slate-400">‘자세히 보기’로 위원별 상세를 확인하세요.</span>
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
            return (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                {/* 기업명 */}
                <div className="w-48 shrink-0">
                  <span className="block truncate font-medium text-slate-800">{s.name}</span>
                </div>
                {/* 진행(N/M + 바) */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${allDone ? 'bg-[var(--gov-navy)]' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-700">
                    {inputCount}/{total}
                  </span>
                </div>
                {/* 입력/미입력 (제출 기준) */}
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
                  onClick={() => setOpenId(s.id)}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
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
          subjectName={subjects[openIdx].name}
          rows={evRowsAt(openIdx)}
          summary={{ done: evRowsAt(openIdx).filter((r) => isSubmitted(r.cell.status)).length, total: evaluators.length }}
          sessionId={sessionId}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  )
}

// ── 기업 상세 모달: 위원별 상태 + 항목 펼침 + (제출완료면) 승인/반려 ──
function SubjectDetailModal({
  subjectName,
  rows,
  summary,
  sessionId,
  onClose,
}: {
  subjectName: string
  rows: EvRow[]
  summary: { done: number; total: number }
  sessionId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const decide = async (subjectId: string, evaluatorId: string, approve: boolean) => {
    setBusy(evaluatorId)
    try {
      if (approve) await approveEvaluation(sessionId, subjectId, evaluatorId)
      else await rejectEvaluation(sessionId, subjectId, evaluatorId)
      router.refresh()
      onClose()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-800">{subjectName}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              제출 <span className="font-semibold text-slate-700">{summary.done}/{summary.total}</span> 위원
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <ul className="divide-y divide-slate-50 overflow-auto px-2 py-1">
          {rows.map((r) => {
            const c = r.cell
            const isOpen = !!expanded[r.userId]
            return (
              <li key={r.userId} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    {r.isChair && <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">위원장</span>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[c.status]}`}>{statusLabel(c.status)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">{c.done}/{c.total}</span>
                  {c.total > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [r.userId]: !p[r.userId] }))}
                      className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-50"
                    >
                      항목 {isOpen ? '▴' : '▾'}
                    </button>
                  )}
                </div>

                {/* 제출완료 → 바로 승인/반려 */}
                {c.status === 'submitted' && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy === r.userId} onClick={() => decide(c.subjectId, r.userId, false)} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">반려</button>
                    <button type="button" disabled={busy === r.userId} onClick={() => decide(c.subjectId, r.userId, true)} className="flex-1 rounded-lg bg-[var(--gov-navy)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">승인</button>
                  </div>
                )}

                {/* 항목별 입력 현황 */}
                {isOpen && (
                  <ul className="mt-2 space-y-0.5 rounded-lg bg-slate-50 p-2">
                    {c.items.length === 0 && <li className="px-1 text-xs text-slate-400">평가 항목이 없습니다.</li>}
                    {c.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${it.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>{it.done ? '✓' : '·'}</span>
                        <span className={`truncate ${it.done ? 'text-slate-700' : 'text-slate-400'}`}>{it.name}</span>
                        <span className={`ml-auto shrink-0 text-xs ${it.done ? 'text-emerald-600' : 'text-slate-400'}`}>{it.done ? '입력완료' : '미입력'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
