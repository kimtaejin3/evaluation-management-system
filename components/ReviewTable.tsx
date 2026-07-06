'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveEvaluation, rejectEvaluation } from '@/app/admin/sessions/actions'
import { cellStatusLabel } from '@/lib/submission'
import type { ReviewRow } from '@/lib/progress'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// 간사 제출 검토 표 — 제출완료 건만 승인/반려. 클릭 시 확인 모달에서 [승인]/[반려] 선택 확정.
export default function ReviewTable({ sessionId, rows }: { sessionId: string; rows: ReviewRow[] }) {
  const [target, setTarget] = useState<ReviewRow | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  const decide = async (approve: boolean) => {
    if (!target) return
    setBusy(true)
    try {
      if (approve) await approveEvaluation(sessionId, target.subjectId, target.evaluatorId)
      else await rejectEvaluation(sessionId, target.subjectId, target.evaluatorId)
      setTarget(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">제출 검토</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2 font-medium">대상</th>
              <th className="px-4 py-2 font-medium">위원</th>
              <th className="px-4 py-2 text-right font-medium">점수</th>
              <th className="px-4 py-2 font-medium">현황</th>
              <th className="px-4 py-2 text-right font-medium">승인</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.subjectId}:${r.evaluatorId}`} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 text-slate-700">{r.subjectName}</td>
                <td className="px-4 py-2 text-slate-700">{r.evaluatorName}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">{r.total != null ? fmt(r.total) : '-'}</td>
                <td className="px-4 py-2 text-slate-600">{cellStatusLabel(r.status)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    disabled={r.status !== 'submitted'}
                    onClick={() => setTarget(r)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    승인/반려
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">평가가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-bold text-slate-900">{target.subjectName} · {target.evaluatorName}</h3>
            <p className="mt-1 text-sm text-slate-500">이 평가를 승인 또는 반려합니다.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setTarget(null)} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">취소</button>
              <button type="button" onClick={() => decide(false)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">반려</button>
              <button type="button" onClick={() => decide(true)} disabled={busy} className="rounded-lg bg-[var(--gov-navy)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--gov-navy-hover)] disabled:opacity-50">승인</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
