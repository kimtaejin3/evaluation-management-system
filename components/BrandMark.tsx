export default function BrandMark({
  className = 'h-8 w-8',
  variant = 'onDark',
}: {
  className?: string
  variant?: 'onDark' | 'solid'
}) {
  // 심사·평가 — 체크된 점검표(clipboard-check) 아이콘
  const bg = variant === 'solid' ? 'bg-[var(--gov-primary)] text-white' : 'bg-white/15'
  return (
    <span className={`flex items-center justify-center rounded-md ${bg} ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="h-[60%] w-[60%]" aria-hidden>
        <path
          d="M9 4h6a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v0a1 1 0 0 1 1-1Z"
          fill="currentColor"
        />
        <path
          d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v12A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 5H16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m9 13 2 2 4-4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
