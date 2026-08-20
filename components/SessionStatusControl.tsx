'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSessionStatus } from '@/app/admin/sessions/actions'

type Status = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'

// 상태는 배경·테두리 없이 색 글씨로만 구분
const MAP: Record<Status, { label: string; cls: string }> = {
  DRAFT: { label: '준비', cls: 'text-slate-500' },
  IN_PROGRESS: { label: '진행중', cls: 'text-blue-600' },
  CLOSED: { label: '완료', cls: 'text-emerald-600' },
}

// 실시간 진행 상황의 상태 표시 — 관리자·담당자 공통으로 배지 + '평가 시작'(준비일 때만)뿐.
// 상태 변경 모달은 없다: 마감은 집계 결과 제출 → 관리자 검토 완료, 되돌리기는 '분과 재개'로만.
export default function SessionStatusControl({
  sessionId,
  status,
}: {
  sessionId: string
  status: Status
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const badge = MAP[status]

  const start = () => {
    if (!confirm('평가를 시작할까요? 분과가 진행중으로 바뀌고 평가위원이 점수를 입력할 수 있습니다.')) return
    startTransition(async () => {
      await setSessionStatus(sessionId, 'IN_PROGRESS')
      // 변경 즉시 화면 반영(서버 컴포넌트 재조회)
      router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`text-sm font-medium whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
      {status === 'DRAFT' && (
        <button
          type="button"
          disabled={pending}
          onClick={start}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? '처리 중…' : '평가 시작'}
        </button>
      )}
    </span>
  )
}
