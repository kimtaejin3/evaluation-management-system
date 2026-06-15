'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'connecting' | 'live' | 'polling' | 'paused'

const POLL_FALLBACK_MS = 7000 // SSE 실패 시 폴링 주기
const FALLBACK_AFTER_MS = 8000 // SSE 끊김 후 이 시간 내 미복구면 폴링 전환

// 대시보드 진행 상태를 실시간 반영: SSE 우선, 실패 시 폴링 폴백.
// 갱신은 router.refresh()로 서버 컴포넌트(모니터링 그리드·KPI)를 그대로 다시 받아 처리.
export default function LiveRefresher({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('connecting')
  const [enabled, setEnabled] = useState(true)
  const [secsAgo, setSecsAgo] = useState(0)

  const esRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastUpdatedRef = useRef<number>(Date.now())

  const markUpdated = () => {
    lastUpdatedRef.current = Date.now()
    setSecsAgo(0)
  }

  // "n초 전" 표시 갱신
  useEffect(() => {
    const t = setInterval(() => setSecsAgo(Math.floor((Date.now() - lastUpdatedRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!enabled) {
      teardown()
      setMode('paused')
      return
    }
    connect()
    return teardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId])

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
    setMode('polling')
    if (pollRef.current) return
    pollRef.current = setInterval(() => {
      router.refresh()
      markUpdated()
    }, POLL_FALLBACK_MS)
  }

  function connect() {
    // EventSource 미지원 환경 → 바로 폴링
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      startPolling()
      return
    }
    try {
      const es = new EventSource(`/api/sessions/${sessionId}/progress/stream`)
      esRef.current = es

      es.addEventListener('connected', () => {
        setMode('live')
        clearFallback()
        stopPolling()
      })
      es.addEventListener('update', () => {
        router.refresh()
        markUpdated()
      })
      es.onerror = () => {
        // 스트림 정상 종료 시에도 onerror가 뜨고 브라우저가 자동 재연결함.
        // 일정 시간 내 복구 안 되면 폴링으로 폴백.
        if (esRef.current && es.readyState === EventSource.CONNECTING) setMode('connecting')
        if (!fallbackRef.current) {
          fallbackRef.current = setTimeout(() => {
            // 그래도 live가 아니면 폴링 시작(브라우저 재연결과 병행, 복구되면 connected에서 중지)
            startPolling()
          }, FALLBACK_AFTER_MS)
        }
      }
    } catch {
      startPolling()
    }
  }

  const dot =
    mode === 'live'
      ? 'bg-emerald-500'
      : mode === 'polling'
        ? 'bg-amber-500'
        : mode === 'paused'
          ? 'bg-slate-300'
          : 'bg-slate-400 animate-pulse'
  const label =
    mode === 'live' ? '실시간' : mode === 'polling' ? '폴링 모드' : mode === 'paused' ? '일시정지' : '연결 중…'

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="font-medium text-slate-600">{label}</span>
      </span>
      {enabled && mode !== 'paused' && (
        <span className="text-slate-400">· {secsAgo < 2 ? '방금 갱신' : `${secsAgo}초 전 갱신`}</span>
      )}
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        className="rounded-md border border-slate-300 px-2 py-0.5 text-slate-600 transition hover:bg-slate-50"
      >
        {enabled ? '자동 갱신 끄기' : '자동 갱신 켜기'}
      </button>
    </div>
  )
}
