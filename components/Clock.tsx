'use client'

import { useEffect, useState } from 'react'

export default function Clock() {
  const [now, setNow] = useState<string>('')
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('ko-KR', { hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])
  return <span suppressHydrationWarning className="tabular-nums">{now || '--:--:--'}</span>
}
