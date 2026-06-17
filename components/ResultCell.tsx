'use client'

import { useRef, useState } from 'react'

// 집계표 한 칸: 위원 평균 표시 + hover 시 위원별 점수 툴팁
export default function ResultCell({
  avg,
  scores,
}: {
  avg: number | null
  scores: { name: string; value: number | null }[]
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ x: r.left + r.width / 2, y: r.top })
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        className="cursor-default tabular-nums"
      >
        {avg === null ? '—' : avg.toFixed(1)}
      </span>
      {pos && scores.length > 0 && (
        <span
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-full flex-col gap-0.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-xs text-white shadow-lg print:hidden"
          style={{ left: pos.x, top: pos.y - 6 }}
        >
          <span className="mb-0.5 font-semibold text-slate-300">위원별 점수</span>
          {scores.map((s, i) => (
            <span key={i} className="flex items-center justify-between gap-3 whitespace-nowrap">
              <span className="text-slate-200">{s.name}</span>
              <span className={s.value === null ? 'text-slate-500' : 'font-medium text-white tabular-nums'}>
                {s.value === null ? '미입력' : s.value}
              </span>
            </span>
          ))}
        </span>
      )}
    </>
  )
}
