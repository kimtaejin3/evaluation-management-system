// 스트리밍 SSR용 스켈레톤 — 서비스 톤(슬레이트/인디고, rounded-xl 화이트 카드)에 맞춤.
// 서버 컴포넌트(클라이언트 코드 없음). Suspense fallback으로 사용.

function Bar({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-slate-200/70 ${className}`} />
}

// 카드 한 장(제목 + 본문 줄)
export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <Bar className="mb-4 h-5 w-32" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Bar key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

// 표(헤더 + 행들)
export function SkeletonTable({ rows = 6, cols = 4, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
        {Array.from({ length: cols }).map((_, c) => (
          <Bar key={c} className={`h-3.5 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Bar key={c} className={`h-3.5 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// KPI 스탯 스트립 (colsClass는 Tailwind가 인식하도록 리터럴로 전달)
export function SkeletonStats({ count = 3, colsClass = 'lg:grid-cols-3', className = '' }: { count?: number; colsClass?: string; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${colsClass} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
          <Bar className="mb-3 h-3 w-20" />
          <Bar className="h-7 w-16" />
        </div>
      ))}
    </div>
  )
}

// 카드 그리드(여러 장)
export function SkeletonCardGrid({ count = 3, lines = 2, cols = 'sm:grid-cols-2', className = '' }: { count?: number; lines?: number; cols?: string; className?: string }) {
  return (
    <div className={`grid gap-3 ${cols} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  )
}
