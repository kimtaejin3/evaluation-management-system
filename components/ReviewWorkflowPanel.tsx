'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type ReviewStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

// 간사 제출 → 관리자 승인/반려 공통 검토 배너.
// 서버 액션은 페이지(서버 컴포넌트)에서 주입한다. draftBadge로 도메인별 '작성중/배정중' 라벨만 다르게.
export default function ReviewWorkflowPanel({
  sessionId,
  isMaster,
  status,
  rejectionReason,
  draftBadge = '작성중',
  onSubmit,
  onCancelSubmit,
  onApprove,
  onReject,
}: {
  sessionId: string
  isMaster: boolean
  status: ReviewStatus
  rejectionReason: string | null
  draftBadge?: string
  onSubmit: (sessionId: string) => Promise<void>
  onCancelSubmit: (sessionId: string) => Promise<void>
  onApprove: (sessionId: string) => Promise<void>
  onReject: (sessionId: string, reason: string) => Promise<void>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh() })

  const tone: Record<ReviewStatus, string> = {
    DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
    SUBMITTED: 'border-violet-200 bg-violet-50 text-violet-700',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  }
  const label: Record<ReviewStatus, string> = {
    DRAFT: draftBadge,
    SUBMITTED: '제출됨',
    APPROVED: '승인됨',
    REJECTED: '반려됨',
  }

  const message = (() => {
    if (isMaster) {
      if (status === 'DRAFT') return '간사가 작성 중입니다. 제출 후 검토할 수 있습니다.'
      if (status === 'REJECTED') return '반려됨 · 간사가 수정 중입니다. 다시 제출하면 검토할 수 있습니다.'
      if (status === 'SUBMITTED') return '간사가 제출했습니다. 검토 후 승인 또는 반려하세요.'
      return '승인 완료 — 필요 시 다시 반려하면 간사가 재수정합니다.'
    }
    if (status === 'DRAFT') return '작성한 뒤 제출하면 관리자가 검토합니다.'
    if (status === 'REJECTED') return '관리자가 반려했습니다. 수정한 뒤 다시 제출하세요.'
    if (status === 'SUBMITTED') return '제출됨 · 관리자 검토를 기다리는 중입니다.'
    return '관리자가 승인했습니다.'
  })()

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${tone[status]}`}>
      <div className="min-w-0">
        <span className="font-semibold">{label[status]}</span>
        <span className="ml-2 opacity-90">{message}</span>
        {status === 'REJECTED' && rejectionReason && (
          <p className="mt-1 text-xs">반려 사유: {rejectionReason}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isMaster && (status === 'DRAFT' || status === 'REJECTED') && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('제출할까요? 제출하면 관리자가 검토하며, 제출 중에는 수정할 수 없습니다.')) return
              run(() => onSubmit(sessionId))
            }}
            className="rounded-lg bg-[var(--gov-navy)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? '처리 중…' : status === 'REJECTED' ? '다시 제출' : '제출'}
          </button>
        )}
        {!isMaster && status === 'SUBMITTED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('제출을 취소하고 다시 수정 상태로 되돌릴까요?')) return
              run(() => onCancelSubmit(sessionId))
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? '처리 중…' : '제출 취소'}
          </button>
        )}

        {isMaster && (status === 'SUBMITTED' || status === 'APPROVED') && (
          <>
            {status === 'SUBMITTED' && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm('승인할까요?')) return
                  run(() => onApprove(sessionId))
                }}
                className="rounded-lg bg-[var(--gov-navy)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? '처리 중…' : '승인'}
              </button>
            )}
            <RejectButton pending={pending} run={run} onReject={(reason) => onReject(sessionId, reason)} />
          </>
        )}
      </div>
    </div>
  )
}

// 반려 사유 입력 모달(관리자)
function RejectButton({
  pending,
  run,
  onReject,
}: {
  pending: boolean
  run: (fn: () => Promise<void>) => void
  onReject: (reason: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const submit = () => {
    const trimmed = reason.trim()
    if (!trimmed) return
    run(async () => {
      await onReject(trimmed)
      setOpen(false)
      setReason('')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
      >
        반려
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">반려 사유</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 transition hover:text-slate-600">✕</button>
            </div>
            <p className="mt-2 text-xs text-slate-400">반려하면 담당 간사에게 사유가 표시되며, 간사가 수정 후 다시 제출합니다.</p>
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
