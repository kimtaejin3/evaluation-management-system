'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordMonitorView } from '@/app/admin/sessions/actions'

// 실시간 모니터링의 '자세히 보기' — 클릭 시점을 기록(조회 시간 컬럼)하고 분과 상세로 이동.
export default function MonitorDetailLink({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await recordMonitorView(sessionId)
          router.push(`/admin/sessions/${sessionId}`)
        })
      }
      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? '이동 중…' : '자세히 보기'}
    </button>
  )
}
