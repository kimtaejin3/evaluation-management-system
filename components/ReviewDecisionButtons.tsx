'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveSubjectReview,
  rejectSubjectReview,
  approveEvaluators,
  rejectEvaluators,
  approveOpinions,
  rejectOpinions,
} from '@/app/admin/sessions/actions'

type Kind = 'subjects' | 'evaluators' | 'opinions'

const ACTIONS: Record<Kind, { approve: (id: string) => Promise<void>; reject: (id: string, reason: string) => Promise<void> }> = {
  subjects: { approve: approveSubjectReview, reject: rejectSubjectReview },
  evaluators: { approve: approveEvaluators, reject: rejectEvaluators },
  opinions: { approve: approveOpinions, reject: rejectOpinions },
}

// 과제 페이지 테이블의 '액션' 컬럼용 — 승인/반려 버튼을 항상 쌍으로 노출한다.
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

  const canApprove = status === 'SUBMITTED'
  const canReject = status === 'SUBMITTED' || status === 'APPROVED'

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
        title={canApprove ? undefined : wording === 'review' ? '간사가 검토 완료해야 승인할 수 있습니다' : '간사가 제출 완료해야 승인할 수 있습니다'}
        className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium whitespace-nowrap text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        승인
      </button>
      <button
        type="button"
        disabled={pending || !canReject}
        onClick={() => setRejecting(true)}
        title={canReject ? undefined : wording === 'review' ? '검토 완료 또는 승인 상태에서만 반려할 수 있습니다' : '제출 완료 또는 승인 상태에서만 반려할 수 있습니다'}
        className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        반려
      </button>
    </span>
  )
}
