'use client'

import { useEffect, useRef, useState } from 'react'

// 핸드사인 캔버스 — 마우스/터치로 서명을 그리고 PNG data URL로 onChange에 전달.
// 비어 있으면 null. '지우기'로 초기화. 인쇄 평가표 '(인)' 자리에 들어가므로 투명 배경 PNG.
export default function SignaturePad({
  onChange,
  width = 320,
  height = 120,
}: {
  onChange: (dataUrl: string | null) => void
  width?: number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current!
    // 선명한 선을 위해 devicePixelRatio 반영
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1e293b'
  }, [width, height])

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // 점 하나만 찍어도 보이도록
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    commit()
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    commit()
  }
  const commit = () => {
    setEmpty(false)
    onChange(canvasRef.current!.toDataURL('image/png'))
  }
  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width, height, touchAction: 'none' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="rounded-lg border border-slate-300 bg-white"
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            여기에 서명해주세요
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-slate-400">마우스나 손가락으로 서명하세요</span>
        <button
          type="button"
          onClick={clear}
          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-50"
        >
          지우기
        </button>
      </div>
    </div>
  )
}
