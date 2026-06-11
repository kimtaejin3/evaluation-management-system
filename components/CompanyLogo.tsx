// 기업 로고(시각용) — 업로드 기능 없이, 이름 기반으로 결정되는 추상 기하 로고마크
const COLORS = ['#1c3a64', '#0f766e', '#3730a3', '#155e75', '#1e40af', '#0e7490', '#7c3aed', '#b45309']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// 흰색 심볼(솔리드 컬러 타일 위) — 실제 로고마크 느낌
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

export default function CompanyLogo({ name, className = 'h-10 w-10' }: { name: string; className?: string }) {
  const h = hash(name)
  const color = COLORS[h % COLORS.length]
  const shape = SHAPES[Math.floor(h / 8) % SHAPES.length]
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]">
        {shape('s')}
      </svg>
    </span>
  )
}
