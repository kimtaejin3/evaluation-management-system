'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeReview, reopenSession } from '@/app/admin/sessions/actions'

// 사업 집계 결과 테이블의 '검토 상태' 컬럼 — 다른 테이블 '승인 상태'처럼 배지 없이 버튼 상태로만 표시.
// 미제출: 흰 배경·비활성 / 담당자 제출: 활성 + 안내 / 검토 완료(closed): primary 채움(선택). 관리자 전용.
export default function ResultsReviewCell({
  sessionId,
  submitted,
  closed,
  isMaster,
  opinionApproved = true,
}: {
  sessionId: string
  submitted: boolean
  closed: boolean
  isMaster: boolean
  // 평가 의견서 관리자 승인 여부 — 승인 전에는 서버(completeReview)가 마감을 거부하므로
  // 버튼을 비활성화하고 사유를 보여준다(조용히 무시되던 문제 수정)
  opinionApproved?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (!isMaster) return null

  const canComplete = submitted && opinionApproved
  const base = 'rounded px-2 py-1 text-xs font-medium whitespace-nowrap transition'
  const cls = closed
    ? `${base} bg-indigo-600 text-white cursor-default`
    : canComplete
      ? `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`
      : `${base} border border-slate-200 bg-white text-slate-300 cursor-not-allowed`

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={pending || closed || !canComplete}
        title={
          !submitted
            ? '담당자가 제출 완료해야 검토할 수 있습니다'
            : !opinionApproved
              ? '평가 의견서를 승인해야 검토 완료할 수 있습니다'
              : undefined
        }
        onClick={() => {
          if (!confirm("이 분과의 검토를 완료하고 '완료' 상태로 전환할까요? 점수가 잠깁니다.")) return
          start(async () => {
            await completeReview(sessionId)
            router.refresh()
          })
        }}
        className={cls}
      >
        {pending ? '처리 중…' : '검토 완료'}
      </button>
      {submitted && !closed && opinionApproved && (
        <span className="text-xs whitespace-nowrap text-slate-500">담당자가 제출하였습니다. 검토 완료하세요.</span>
      )}
      {submitted && !closed && !opinionApproved && (
        <span className="text-xs whitespace-nowrap text-amber-600">평가 의견서 승인 후 검토 완료할 수 있습니다.</span>
      )}
      {/* 마감(완료) 후에도 되돌릴 수 있게 — 분과 재개(점수 잠금 해제, 다시 진행 상태로) */}
      {closed && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm('이 분과를 다시 진행 상태로 되돌릴까요? 점수 잠금이 풀리고 담당자·위원이 다시 작업할 수 있습니다.')) return
            start(async () => {
              await reopenSession(sessionId)
              router.refresh()
            })
          }}
          className={`${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
        >
          {pending ? '처리 중…' : '분과 재개'}
        </button>
      )}
    </div>
  )
}
