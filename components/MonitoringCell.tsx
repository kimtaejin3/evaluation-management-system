'use client'

import { useEffect, useRef, useState } from 'react'
import type { Cell } from '@/lib/progress'

const DONE = 'border border-slate-900 bg-slate-900'
const NONE = 'border border-slate-300 bg-white'
// 입력 중으로 간주할 신선도(ms) — 위원 클라이언트가 4초마다 핑, 이보다 오래되면 만료
const EDIT_FRESH_MS = 9000

export default function MonitoringCell({ cell }: { cell: Cell }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  // 입력 중 신선도를 클라이언트 시계로 자체 만료(서버 재요청 없이 애니메이션 정지)
  const [now, setNow] = useState(() => Date.now())
  const hasEditing = cell.items.some((it) => !it.done && it.editingAt != null)
  useEffect(() => {
    if (!hasEditing) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [hasEditing])

  if (cell.total === 0) {
    return <span className={`mx-auto block h-5 w-24 rounded-[5px] ${NONE}`} />
  }

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ x: r.left + r.width / 2, y: r.top })
  }

  const isEditing = (it: Cell['items'][number]) =>
    !it.done && it.editingAt != null && now - it.editingAt < EDIT_FRESH_MS

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        className="mx-auto flex h-5 w-fit gap-1"
      >
        {cell.items.map((it) => (
          <span
            key={it.id}
            className={`w-2.5 rounded-[3px] ${it.done ? DONE : isEditing(it) ? 'ants' : NONE}`}
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
