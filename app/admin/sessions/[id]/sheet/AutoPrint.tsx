'use client'

import { useEffect } from 'react'

// 평가표 페이지 진입 시 브라우저 기본 인쇄 대화상자를 자동으로 띄운다(총괄표 인쇄와 동일한 경험).
export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [])
  return null
}
