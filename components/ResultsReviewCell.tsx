'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeReview } from '@/app/admin/sessions/actions'

// 과제 집계 결과 테이블의 '검토 상태' 컬럼 — 배지 + 관리자 검토 완료 버튼(컴팩트).
// 간사가 제출 완료(submitted)해야 검토 완료할 수 있고, 완료(closed)되면 점수가 잠긴다.
export default function ResultsReviewCell({
  sessionId,
  submitted,
  closed,
  isMaster,
}: {
  sessionId: string
  submitted: boolean
  closed: boolean
  isMaster: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const badge = closed ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 ring-1 ring-inset ring-emerald-200">
      검토 완료
    </span>
  ) : submitted ? (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-amber-700 ring-1 ring-inset ring-amber-200">
      대기
    </span>
  ) : (
    <span className="text-slate-300">—</span>
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badge}
      {isMaster && !closed && (
        <button
          type="button"
          disabled={pending || !submitted}
          title={submitted ? undefined : '간사가 제출 완료해야 검토할 수 있습니다'}
          onClick={() => {
            if (!confirm("이 분과의 검토를 완료하고 '완료' 상태로 전환할까요? 점수가 잠깁니다.")) return
            start(async () => {
              await completeReview(sessionId)
              router.refresh()
            })
          }}
          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium whitespace-nowrap text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? '처리 중…' : '검토 완료'}
        </button>
      )}
    </div>
  )
}
