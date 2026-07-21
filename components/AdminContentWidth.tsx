'use client'

import { usePathname } from 'next/navigation'

// 관리자 본문 너비 — 기본은 max-w-7xl로 제한하되, '분과 간사 설정'(과제 홈,
// /admin/projects/[id] 정확 일치)만 풀 너비로 표시한다.
export default function AdminContentWidth({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const fullWidth = /^\/admin\/projects\/[^/]+$/.test(path)
  return <div className={fullWidth ? 'w-full' : 'mx-auto w-full max-w-7xl'}>{children}</div>
}
