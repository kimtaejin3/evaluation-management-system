'use client'

import Link from 'next/link'
import type { ProgressData, Cell } from '@/lib/progress'
import { cellStatusLabel, type CellStatus } from '@/lib/submission'

// 기업(대상) 중심 리스트 — 각 대상의 입력/제출 진행 현황 조회.
// '자세히 보기'는 '평가 의견서' 탭으로 이동한다. 위원별 제출 승인/반려는 이 화면 하단의 검토 표(ReviewTable)에서.

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

  const evRowsAt = (si: number): EvRow[] =>
    evaluators.map((e) => ({ userId: e.userId, name: e.name, isChair: e.isChair, cell: e.cells[si] }))

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
                <div className="min-w-0 flex-1" />
                <Link
                  href={`/admin/sessions/${sessionId}/opinions`}
                  className="text-sm font-medium text-slate-600 transition hover:text-indigo-700 hover:underline"
                >
                  자세히 보기
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
