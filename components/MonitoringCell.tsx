'use client'

import { useRef, useState } from 'react'
import type { Cell } from '@/lib/progress'

const DONE = 'border border-slate-900 bg-slate-900'
const NONE = 'border border-slate-300 bg-white'

export default function MonitoringCell({ cell }: { cell: Cell }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  if (cell.total === 0) {
    return <span className={`mx-auto block h-5 w-24 rounded-[5px] ${NONE}`} />
  }

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ x: r.left + r.width / 2, y: r.top })
  }

  const partial = cell.state === 'partial'

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        className="mx-auto flex h-5 w-24 gap-1"
        title={partial ? '입력 중' : undefined}
      >
        {cell.items.map((it) => (
          <span
            key={it.id}
            className={`flex-1 rounded-[4px] ${it.done ? DONE : partial ? 'ants' : NONE}`}
          />
        ))}
      </span>
      {pos && (
        <span
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-full flex-col gap-0.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-xs text-white"
          style={{ left: pos.x, top: pos.y - 6 }}
        >
          {cell.items.map((it) => (
            <span key={it.id} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={it.done ? 'text-emerald-300' : 'text-slate-500'}>{it.done ? '✓' : '·'}</span>
              {it.name}
            </span>
          ))}
        </span>
      )}
    </>
  )
}
