'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  submitCriteria,
  cancelSubmitCriteria,
  approveCriteria,
  rejectCriteria,
} from '@/app/admin/sessions/actions'

export type CriteriaStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

// 평가항목 검토 워크플로 배너 — 간사: 제출/제출취소, 관리자: 승인/반려(사유).
// 간사가 제출(SUBMITTED)해야 관리자가 항목을 보고 검토할 수 있다.
export default function CriteriaReviewPanel({
  sessionId,
  isMaster,
  status,
  rejectionReason,
}: {
  sessionId: string
  isMaster: boolean
  status: CriteriaStatus
  rejectionReason: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh() })

  const tone: Record<CriteriaStatus, string> = {
    DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
    SUBMITTED: 'border-violet-200 bg-violet-50 text-violet-700',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  // 상태·역할별 안내 문구
  const message = (() => {
    if (isMaster) {
      if (status === 'DRAFT') return '간사가 평가 항목을 입력 중입니다. 제출 후 검토할 수 있습니다.'
      if (status === 'REJECTED') return '반려됨 · 간사가 재작성 중입니다. 다시 제출하면 검토할 수 있습니다.'
      if (status === 'SUBMITTED') return '간사가 제출한 평가 항목입니다. 검토 후 승인 또는 반려하세요.'
      return '승인 완료 — 필요 시 다시 반려하면 간사가 재수정합니다.'
    }
    if (status === 'DRAFT') return '평가 항목을 작성한 뒤 제출하면 관리자가 검토합니다.'
    if (status === 'REJECTED') return '관리자가 평가 항목을 반려했습니다. 항목을 수정한 뒤 다시 제출하세요.'
    if (status === 'SUBMITTED') return '제출됨 · 관리자 검토를 기다리는 중입니다.'
    return '승인됨 — 관리자가 평가 항목을 승인했습니다.'
  })()

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${tone[status]}`}>
      <div className="min-w-0">
        <span className="font-semibold">
          {STATUS_LABEL[status]}
        </span>
        <span className="ml-2 opacity-90">{message}</span>
        {status === 'REJECTED' && rejectionReason && (
          <p className="mt-1 text-xs">반려 사유: {rejectionReason}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* 간사 액션 */}
        {!isMaster && (status === 'DRAFT' || status === 'REJECTED') && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('평가 항목을 제출할까요? 제출하면 관리자가 검토하며, 제출 중에는 수정할 수 없습니다.')) return
              run(() => submitCriteria(sessionId))
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
              run(() => cancelSubmitCriteria(sessionId))
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? '처리 중…' : '제출 취소'}
          </button>
        )}

        {/* 관리자 액션 */}
        {isMaster && (status === 'SUBMITTED' || status === 'APPROVED') && (
          <>
            {status === 'SUBMITTED' && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm('이 분과의 평가 항목을 승인할까요?')) return
                  run(() => approveCriteria(sessionId))
                }}
                className="rounded-lg bg-[var(--gov-navy)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? '처리 중…' : '승인'}
              </button>
            )}
            <RejectButton sessionId={sessionId} pending={pending} run={run} />
          </>
        )}
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<CriteriaStatus, string> = {
  DRAFT: '입력중',
  SUBMITTED: '제출됨',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
}

// 반려 사유 입력 모달(관리자)
function RejectButton({
  sessionId,
  pending,
  run,
}: {
  sessionId: string
  pending: boolean
  run: (fn: () => Promise<void>) => void
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
      await rejectCriteria(sessionId, trimmed)
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
              <h3 className="text-base font-semibold text-slate-900">평가 항목 반려</h3>
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
