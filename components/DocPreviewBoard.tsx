'use client'

import { useRef, useState } from 'react'

export interface PreviewDoc {
  id: string
  name: string
  mimeType: string
}

interface PaneState {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
}

// 평가위원이 여러 심사 서류를 동시에 띄워놓고 비교하며 채점할 수 있는 플로팅 프리뷰 보드
export default function DocPreviewBoard({ documents }: { documents: PreviewDoc[] }) {
  const [panes, setPanes] = useState<PaneState[]>([])
  const zTop = useRef(50)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)

  if (documents.length === 0) return null

  const bringFront = (id: string) =>
    setPanes((p) => p.map((pane) => (pane.id === id ? { ...pane, z: ++zTop.current } : pane)))

  const open = (d: PreviewDoc) => {
    setPanes((p) => {
      const existing = p.find((pane) => pane.id === d.id)
      if (existing) {
        // 이미 열려 있으면 최상단으로 + 펼치기
        return p.map((pane) => (pane.id === d.id ? { ...pane, minimized: false, z: ++zTop.current } : pane))
      }
      const i = p.length
      const w = 440
      // 가운데 채점 컬럼/서류 런처를 가리지 않도록 화면 오른쪽에서 계단식으로 띄움
      const baseX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - w - 24) : 700
      return [
        ...p,
        {
          id: d.id,
          name: d.name,
          x: Math.max(16, baseX - (i % 4) * 48),
          y: 72 + (i % 4) * 40,
          w,
          h: 560,
          z: ++zTop.current,
          minimized: false,
        },
      ]
    })
  }

  const close = (id: string) => setPanes((p) => p.filter((pane) => pane.id !== id))
  const toggleMin = (id: string) =>
    setPanes((p) => p.map((pane) => (pane.id === id ? { ...pane, minimized: !pane.minimized } : pane)))

  const onPointerDown = (e: React.PointerEvent, pane: PaneState) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id: pane.id, dx: e.clientX - pane.x, dy: e.clientY - pane.y }
    bringFront(pane.id)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    setPanes((p) =>
      p.map((pane) =>
        pane.id === d.id
          ? { ...pane, x: Math.max(0, e.clientX - d.dx), y: Math.max(0, e.clientY - d.dy) }
          : pane
      )
    )
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const openIds = new Set(panes.map((p) => p.id))

  const tileAll = () =>
    setPanes((p) =>
      p.map((pane, i) => {
        const cols = Math.min(p.length, 3)
        const col = i % cols
        const row = Math.floor(i / cols)
        const w = Math.floor((window.innerWidth - 40) / cols) - 12
        return {
          ...pane,
          minimized: false,
          x: 16 + col * (w + 12),
          y: 72 + row * 300,
          w,
          h: 540,
          z: ++zTop.current,
        }
      })
    )

  return (
    <>
      {/* 서류 런처 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">심사 서류</span>
          <span className="text-xs text-slate-400">클릭하면 프리뷰 창이 열립니다 · 여러 창 동시 비교 가능</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {documents.map((d) => {
            const on = openIds.has(d.id)
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => open(d)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition ${
                  on
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-slate-50 text-indigo-600 hover:bg-slate-100'
                }`}
              >
                📄 {d.name}
                {on && <span className="text-[10px] text-indigo-400">열림</span>}
              </button>
            )
          })}
        </div>
        {panes.length > 1 && (
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={tileAll} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50">
              나란히 정렬
            </button>
            <button type="button" onClick={() => setPanes([])} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50">
              모두 닫기
            </button>
          </div>
        )}
      </div>

      {/* 플로팅 프리뷰 창들 */}
      {panes.map((pane) => (
        <div
          key={pane.id}
          onPointerDown={() => bringFront(pane.id)}
          style={{ left: pane.x, top: pane.y, width: pane.w, zIndex: pane.z }}
          className="fixed flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
        >
          {/* 타이틀바 (드래그 핸들) */}
          <div
            onPointerDown={(e) => onPointerDown(e, pane)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex cursor-move touch-none select-none items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2"
          >
            <span className="truncate text-xs font-semibold text-slate-700">📄 {pane.name}</span>
            <div className="ml-auto flex items-center gap-1">
              <a
                href={`/viewer/${pane.id}`}
                target="_blank"
                rel="noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white hover:text-indigo-600"
                title="새 탭에서 열기"
              >
                ↗
              </a>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => toggleMin(pane.id)}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white"
                title={pane.minimized ? '펼치기' : '접기'}
              >
                {pane.minimized ? '▢' : '—'}
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => close(pane.id)}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white hover:text-rose-600"
                title="닫기"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 내용 (리사이즈 가능) */}
          {!pane.minimized && (
            <div style={{ height: pane.h, resize: 'both', overflow: 'auto' }} className="min-h-50 min-w-65 bg-slate-50">
              <iframe src={`/api/documents/${pane.id}`} title={pane.name} className="h-full w-full border-0" />
            </div>
          )}
        </div>
      ))}
    </>
  )
}
