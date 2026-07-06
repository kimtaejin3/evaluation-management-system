'use client'

import { useEffect } from 'react'

// 진입 시 브라우저 기본 인쇄 대화상자를 자동 표시. iframe 임베드 시엔 부모가 제어하므로 스킵.
export default function AutoPrint() {
  useEffect(() => {
    if (window.self !== window.top) return
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [])
  return null
}
