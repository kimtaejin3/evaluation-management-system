'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type ReviewStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

// 담당자 제출 → 관리자 승인/반려 공통 검토 배너.
// 서버 액션은 페이지(서버 컴포넌트)에서 주입한다. draftBadge로 도메인별 '작성중/배정중' 라벨만 다르게.
// wording: 'submit'(기본, 담당자가 작성해 제출) | 'review'(담당자가 내용을 검토 — 평가 의견서처럼
// 위원이 작성한 것을 담당자가 확인만 하는 도메인은 '제출' 대신 '검토' 표현을 쓴다)
export default function ReviewWorkflowPanel({
  sessionId,
  isMaster,
  status,
  rejectionReason,
  draftBadge = '작성중',
  wording = 'submit',
  approveConfirmBody = '이 분과의 평가를 승인할까요? 승인하면 집계 결과가 확정 단계로 넘어갑니다.',
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
  wording?: 'submit' | 'review'
  // 관리자 승인 확인 모달 본문 — 도메인(평가 대상/의견서 등)에 맞는 문구를 넘긴다
  approveConfirmBody?: string
  onSubmit: (sessionId: string) => Promise<void>
  onCancelSubmit: (sessionId: string) => Promise<void>
  onApprove: (sessionId: string) => Promise<void>
  onReject: (sessionId: string, reason: string) => Promise<void>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh() })

  // 배너 배경은 상태와 무관하게 중립(회색) 톤으로 통일 — 상태 단어에만 은은한 색을 준다.
  const tone = 'border-slate-200 bg-slate-50/60 text-slate-700'
  const labelCls: Record<ReviewStatus, string> = {
    DRAFT: 'text-slate-700',
    SUBMITTED: 'text-slate-700',
    APPROVED: 'text-emerald-700',
    REJECTED: 'text-rose-600',
  }
  const isReview = wording === 'review'
  const label: Record<ReviewStatus, string> = {
    DRAFT: draftBadge,
    SUBMITTED: isReview ? '검토 완료' : '제출됨',
    APPROVED: '승인됨',
    REJECTED: '반려됨',
  }
  // 버튼·확인창 용어
  const t = isReview
    ? {
        submit: '검토 완료',
        resubmit: '다시 검토 완료',
        cancel: '검토 취소',
        submitConfirm: '검토를 완료할까요? 완료하면 관리자가 승인/반려를 진행합니다.',
        cancelConfirm: '검토 완료를 취소하고 다시 검토 상태로 되돌릴까요?',
      }
    : {
        submit: '제출',
        resubmit: '다시 제출',
        cancel: '제출 취소',
        submitConfirm: '제출할까요? 제출하면 관리자가 검토하며, 제출 중에는 수정할 수 없습니다.',
        cancelConfirm: '제출을 취소하고 다시 수정 상태로 되돌릴까요?',
      }

  const message = (() => {
    if (isMaster) {
      if (isReview) {
        if (status === 'DRAFT') return '담당자가 검토 중입니다. 검토 완료 후 확인할 수 있습니다.'
        if (status === 'REJECTED') return '반려됨 · 담당자가 다시 검토 중입니다. 검토 완료하면 확인할 수 있습니다.'
        if (status === 'SUBMITTED') return '담당자가 검토를 완료했습니다. 확인 후 승인 또는 반려하세요.'
        return '승인 완료 — 필요 시 다시 반려하면 담당자가 재검토합니다.'
      }
      if (status === 'DRAFT') return '담당자가 작성 중입니다. 제출 후 검토할 수 있습니다.'
      if (status === 'REJECTED') return '반려됨 · 담당자가 수정 중입니다. 다시 제출하면 검토할 수 있습니다.'
      if (status === 'SUBMITTED') return '담당자가 제출했습니다. 검토 후 승인 또는 반려하세요.'
      return '승인 완료 — 필요 시 다시 반려하면 담당자가 재수정합니다.'
    }
    if (isReview) {
      if (status === 'DRAFT') return '의견서를 확인한 뒤 검토 완료하면 관리자가 승인합니다.'
      if (status === 'REJECTED') return '관리자가 반려했습니다. 내용을 확인한 뒤 다시 검토 완료하세요.'
      if (status === 'SUBMITTED') return '검토 완료 · 관리자 승인을 기다리는 중입니다.'
      return '관리자가 승인했습니다.'
    }
    if (status === 'DRAFT') return '작성한 뒤 제출하면 관리자가 검토합니다.'
    if (status === 'REJECTED') return '관리자가 반려했습니다. 수정한 뒤 다시 제출하세요.'
    if (status === 'SUBMITTED') return '제출됨 · 관리자 검토를 기다리는 중입니다.'
    return '관리자가 승인했습니다.'
  })()

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <div className="min-w-0">
        <span className={`font-semibold ${labelCls[status]}`}>{label[status]}</span>
        <span className="ml-2 text-slate-500">{message}</span>
        {status === 'REJECTED' && rejectionReason && (
          <p className="mt-1 text-xs text-rose-600">반려 사유: {rejectionReason}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isMaster && (status === 'DRAFT' || status === 'REJECTED') && (
          <ConfirmButton
            label={status === 'REJECTED' ? t.resubmit : t.submit}
            pending={pending}
            title={isReview ? '검토 완료' : '제출'}
            body={t.submitConfirm}
            confirmLabel={isReview ? '검토 완료' : '제출'}
            onConfirm={() => run(() => onSubmit(sessionId))}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          />
        )}
        {!isMaster && status === 'SUBMITTED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(t.cancelConfirm)) return
              run(() => onCancelSubmit(sessionId))
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? '처리 중…' : t.cancel}
          </button>
        )}

        {isMaster && (status === 'SUBMITTED' || status === 'APPROVED') && (
          <>
            {status === 'SUBMITTED' && (
              <ConfirmButton
                label="승인"
                pending={pending}
                title="승인"
                body={approveConfirmBody}
                confirmLabel="승인"
                onConfirm={() => run(() => onApprove(sessionId))}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              />
            )}
            <RejectButton pending={pending} run={run} onReject={(reason) => onReject(sessionId, reason)} />
          </>
        )}
      </div>
    </div>
  )
}

// 확인 모달이 뜨는 승인/검토완료 버튼
function ConfirmButton({
  label,
  pending,
  title,
  body,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string
  pending: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  className: string
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={className}>
        {pending ? '처리 중…' : label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 transition hover:text-slate-600">✕</button>
            </div>
            <p className="mt-2 text-sm text-slate-500">{body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                취소
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false)
                  onConfirm()
                }}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        반려
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">반려 사유</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 transition hover:text-slate-600">✕</button>
            </div>
            <p className="mt-2 text-xs text-slate-400">반려하면 담당자에게 사유가 표시되며, 담당자가 수정 후 다시 제출합니다.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={4}
              placeholder="반려 사유를 입력하세요"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !reason.trim()}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
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
