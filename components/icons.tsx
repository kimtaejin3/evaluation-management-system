// 사이드바 메뉴용 단색 라인 아이콘 세트 (currentColor 사용)
type IconProps = { className?: string }

function Svg({ className = 'h-[18px] w-[18px]', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

// 대시보드 — 그리드
export function DashboardIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  )
}

// 심사 관리 — 캘린더(체크)
export function SessionsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8 3v3M16 3v3" />
      <path d="m9 15 2 2 3.5-3.5" />
    </Svg>
  )
}

// 평가위원 관리 — 사람들
export function UsersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.8" />
      <path d="M17.5 14.4a5.5 5.5 0 0 1 3 4.9" />
    </Svg>
  )
}

// 기업 관리 — 건물
export function CompanyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
      <path d="M13 9h6a1 1 0 0 1 1 1v11" />
      <path d="M3 21h18" />
      <path d="M7 8h2M7 12h2M7 16h2M16 13h1M16 17h1" />
    </Svg>
  )
}
