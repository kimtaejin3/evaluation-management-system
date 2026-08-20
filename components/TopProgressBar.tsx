'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// 라우트 이동 중 상단에 표시하는 진행바(App Router 전용, 의존성 없음).
// 내부 링크 클릭/뒤로가기 시 시작 → 경로가 바뀌면(커밋) 완료.
// 빠른 전환에서 매번 깜빡이지 않도록, 시작 후 SHOW_DELAY 안에 전환이
// 끝나면 아예 표시하지 않는다(느린 전환에서만 등장).
const SHOW_DELAY = 300

export default function TopProgressBar() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ramp = useRef<ReturnType<typeof setInterval> | null>(null)
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (delay.current) { clearTimeout(delay.current); delay.current = null }
    if (ramp.current) { clearInterval(ramp.current); ramp.current = null }
    if (safety.current) { clearTimeout(safety.current); safety.current = null }
  }

  const start = () => {
    if (ramp.current || delay.current) return // 이미 진행/대기 중
    if (hide.current) { clearTimeout(hide.current); hide.current = null }
    delay.current = setTimeout(() => {
      delay.current = null
      setVisible(true)
      setProgress(8)
      ramp.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p
          const inc = p < 40 ? 9 : p < 70 ? 4 : 1.5
          return Math.min(90, p + inc)
        })
      }, 180)
      // 경로 변경 없이 끝나는 경우 대비(검색파라미터만 변경 등)
      safety.current = setTimeout(finish, 8000)
    }, SHOW_DELAY)
  }

  const finish = () => {
    // 표시 전에 전환이 끝났으면 조용히 취소 — 진행바가 아예 안 보인다
    if (delay.current) { clearTimeout(delay.current); delay.current = null; return }
    clearTimers()
    setProgress(100)
    hide.current = setTimeout(() => { setVisible(false); setProgress(0) }, 280)
  }

  // 경로가 바뀌면(네비게이션 커밋) 완료
  useEffect(() => {
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // 내부 링크 클릭 감지
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const target = a.getAttribute('target')
      if (target && target !== '_self') return
      if (a.hasAttribute('download')) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#')) return
      let url: URL
      try { url = new URL(a.href, location.href) } catch { return }
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname) return // 같은 경로(해시 등)
      start()
    }
    document.addEventListener('click', onClick, true)
    const onPop = () => start()
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop)
      clearTimers()
      if (hide.current) clearTimeout(hide.current)
    }
  }, [])

  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-[#f0b20a] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
