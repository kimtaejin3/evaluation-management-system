'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// 테이블 데이터를 서버에서 가져온 시각 표시 + 작은 수동 새로고침 버튼.
// 마운트 동안 5분마다 자동으로 서버 데이터를 다시 가져온다(router.refresh).
const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export default function TableRefreshControl({ fetchedAt }: { fetchedAt: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className="tabular-nums whitespace-nowrap">조회 시각 {fetchedAt}</span>
      <button
        type="button"
        onClick={() => start(() => router.refresh())}
        disabled={pending}
        title="지금 새로고침"
        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
      >
        {pending ? '갱신 중…' : '새로고침'}
      </button>
    </div>
  )
}
