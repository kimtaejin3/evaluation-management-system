'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const POLL_FALLBACK_MS = 7000 // SSE 실패 시 폴링 주기
const FALLBACK_AFTER_MS = 8000 // SSE 끊김 후 이 시간 내 미복구면 폴링 전환

// 대시보드 진행 상태를 실시간 반영(헤드리스): SSE 우선, 실패 시 폴링 폴백.
// 별도 표시 UI 없이 router.refresh()로 서버 컴포넌트(모니터링 그리드·KPI)를 갱신.
export default function LiveRefresher({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const esRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    function clearFallback() {
      if (fallbackRef.current) {
        clearTimeout(fallbackRef.current)
        fallbackRef.current = null
      }
    }
    function teardown() {
      esRef.current?.close()
      esRef.current = null
      stopPolling()
      clearFallback()
    }
    function startPolling() {
      if (pollRef.current) return
      pollRef.current = setInterval(() => router.refresh(), POLL_FALLBACK_MS)
    }
    function connect() {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
        startPolling()
        return
      }
      try {
        const es = new EventSource(`/api/sessions/${sessionId}/progress/stream`)
        esRef.current = es
        es.addEventListener('connected', () => {
          clearFallback()
          stopPolling()
        })
        es.addEventListener('update', () => router.refresh())
        es.onerror = () => {
          if (!fallbackRef.current) {
            fallbackRef.current = setTimeout(startPolling, FALLBACK_AFTER_MS)
          }
        }
      } catch {
        startPolling()
      }
    }

    connect()
    return teardown
  }, [sessionId, router])

  return null
}
