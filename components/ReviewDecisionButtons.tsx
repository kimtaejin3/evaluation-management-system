'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveOpinions, rejectOpinions } from '@/app/admin/sessions/actions'

// 평가위원·평가대상의 제출/승인 흐름이 제거되어 현재는 의견서(opinions)에서만 쓴다
type Kind = 'opinions'

const ACTIONS: Record<Kind, { approve: (id: string) => Promise<void>; reject: (id: string, reason: string) => Promise<void> }> = {
  opinions: { approve: approveOpinions, reject: rejectOpinions },
}

// 사업 페이지 테이블의 '액션' 컬럼용 — 승인/반려 버튼을 항상 쌍으로 노출한다.
// 승인은 제출(SUBMITTED)일 때만, 반려는 제출·승인(APPROVED)일 때만 활성화(그 외 비활성).
// 관리자 전용 노출은 호출부에서 게이팅. wording='review'면 툴팁에 '검토' 표현을 쓴다(의견서).
export default function ReviewDecisionButtons({
  sessionId,
  status,
  kind,
  wording = 'submit',
}: {
  sessionId: string
  status: string
  kind: Kind
  wording?: 'submit' | 'review'
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const approved = status === 'APPROVED'
  const rejected = status === 'REJECTED'
  // 승인은 제출(SUBMITTED)일 때만, 반려는 제출·승인일 때만 가능.
  const canApprove = status === 'SUBMITTED'
  const canReject = status === 'SUBMITTED' || status === 'APPROVED'

  // 버튼 시각 상태 — 선택됨(primary) / 활성(중립 흰배경) / 비활성(흰배경).
  const base = 'rounded px-2 py-1 text-xs font-medium whitespace-nowrap transition'
  const primaryCls = `${base} bg-indigo-600 text-white cursor-default`
  const activeCls = `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`
  const offCls = `${base} border border-slate-200 bg-white text-slate-300 cursor-not-allowed`
  const approveCls = approved ? primaryCls : canApprove ? activeCls : offCls
  const rejectCls = rejected ? primaryCls : canReject ? activeCls : offCls

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      await fn()
      setRejecting(false)
      setReason('')
      router.refresh()
    })

  if (rejecting) {
    return (
      <span className="flex items-center gap-1.5">
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="반려 사유"
          className="w-32 rounded border border-slate-300 px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || !reason.trim()}
          onClick={() => run(() => ACTIONS[kind].reject(sessionId, reason.trim()))}
          className="rounded bg-slate-600 px-2 py-1 text-xs font-medium whitespace-nowrap text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          반려
        </button>
        <button
          type="button"
          onClick={() => { setRejecting(false); setReason('') }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          취소
        </button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending || !canApprove}
        onClick={() => run(() => ACTIONS[kind].approve(sessionId))}
        title={canApprove ? undefined : wording === 'review' ? '담당자가 검토 완료해야 승인할 수 있습니다' : '담당자가 제출 완료해야 승인할 수 있습니다'}
        className={approveCls}
      >
        승인
      </button>
      <button
        type="button"
        disabled={pending || !canReject}
        onClick={() => setRejecting(true)}
        title={canReject ? undefined : wording === 'review' ? '검토 완료 또는 승인 상태에서만 반려할 수 있습니다' : '제출 완료 또는 승인 상태에서만 반려할 수 있습니다'}
        className={rejectCls}
      >
        반려
      </button>
      {/* 담당자 제출(SUBMITTED) — 결정 대기 안내 */}
      {status === 'SUBMITTED' && (
        <span className="text-xs whitespace-nowrap text-slate-500">
          담당자가 {wording === 'review' ? '검토' : '제출'}하였습니다. 승인 혹은 반려하세요.
        </span>
      )}
    </span>
  )
}
