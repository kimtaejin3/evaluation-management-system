'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { rejectAllAssignments } from '@/app/admin/sessions/actions'

// 배정 평가위원 전체 반려 — 사유 입력 모달(마스터 전용)
export default function RejectAssignmentsModal({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const submit = () => {
    const trimmed = reason.trim()
    if (!trimmed) return
    start(async () => {
      await rejectAllAssignments(sessionId, trimmed)
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
      >
        반려
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">배정 평가위원 반려</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 transition hover:text-slate-600">
                ✕
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              이 분과에 배정된 모든 평가위원이 반려 처리되며, 담당 간사에게 사유가 표시됩니다.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={4}
              placeholder="반려 사유를 입력하세요"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !reason.trim()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-40"
              >
                {pending ? '처리 중…' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
