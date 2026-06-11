'use client'

import { useEffect, useState } from 'react'

// 데모용 실존 기업 → 도메인 매핑 (실제 로고는 favicon 서비스에서 로드)
const DOMAINS: Record<string, string> = {
  '삼성전자': 'samsung.com',
  '네이버': 'naver.com',
  '카카오': 'kakaocorp.com',
  '현대자동차': 'hyundai.com',
  'SK하이닉스': 'skhynix.com',
  'LG화학': 'lgchem.com',
  '포스코': 'posco.com',
  '한화': 'hanwha.com',
}

const COLORS = ['#1c3a64', '#0f766e', '#3730a3', '#155e75', '#1e40af', '#0e7490', '#7c3aed', '#b45309']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// 로고를 못 불러올 때 쓰는 추상 기하 심볼(흰색, 솔리드 타일 위)
const SHAPES: ((k: string) => React.ReactNode)[] = [
  (k) => <circle key={k} cx="12" cy="12" r="6.5" fill="none" stroke="#fff" strokeWidth="2.6" />,
  (k) => <path key={k} d="M12 4.5l7.5 14H4.5z" fill="#fff" />,
  (k) => <path key={k} d="M12 3.5l8 4.5v8l-8 4.5-8-4.5v-8z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />,
  (k) => <path key={k} d="M12 4l8 8-8 8-8-8z" fill="#fff" />,
  (k) => (
    <g key={k} fill="none" stroke="#fff" strokeWidth="2.3">
      <circle cx="9.3" cy="12" r="4.6" />
      <circle cx="14.7" cy="12" r="4.6" />
    </g>
  ),
  (k) => (
    <g key={k} fill="#fff">
      <rect x="4.5" y="4.5" width="6" height="6" rx="1.2" />
      <rect x="13.5" y="4.5" width="6" height="6" rx="1.2" />
      <rect x="4.5" y="13.5" width="6" height="6" rx="1.2" />
      <rect x="13.5" y="13.5" width="6" height="6" rx="1.2" />
    </g>
  ),
  (k) => (
    <g key={k} fill="#fff">
      <rect x="4.5" y="12" width="3.6" height="7.5" rx="1" />
      <rect x="10.2" y="7.5" width="3.6" height="12" rx="1" />
      <rect x="15.9" y="4" width="3.6" height="15.5" rx="1" />
    </g>
  ),
  (k) => <path key={k} d="M4.5 15.5l7.5-8 7.5 8" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />,
]

function GeoMark({ name, className }: { name: string; className: string }) {
  const h = hash(name)
  const color = COLORS[h % COLORS.length]
  const shape = SHAPES[Math.floor(h / 8) % SHAPES.length]
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${className}`} style={{ backgroundColor: color }} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]">{shape('s')}</svg>
    </span>
  )
}

export default function CompanyLogo({ name, className = 'h-10 w-10' }: { name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const domain = DOMAINS[name]

  // 일정 시간 내 로드되지 않으면(오프라인 등) 기하 마크로 폴백
  useEffect(() => {
    if (!domain || loaded) return
    const t = setTimeout(() => setFailed(true), 4000)
    return () => clearTimeout(t)
  }, [domain, loaded])

  if (domain && !failed) {
    return (
      <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          className="h-full w-full object-contain p-1"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
        {/* 로드 전에는 기하 마크가 비치지 않도록 흰 배경 유지 */}
      </span>
    )
  }
  return <GeoMark name={name} className={className} />
}
