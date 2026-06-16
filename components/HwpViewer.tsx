'use client'

import { useEffect, useRef, useState } from 'react'

// 한글(.hwp 5.x) 파일을 브라우저에서 직접 렌더링 — 다운로드 없이 화면 내 열람.
// hwp.js는 브라우저 전용이므로 동적 import.
export default function HwpViewer({ id, name }: { id: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/documents/${id}`)
        if (!res.ok) throw new Error('fetch failed')
        const buf = new Uint8Array(await res.arrayBuffer())
        const mod = await import('hwp.js')
        const Viewer = (mod as { Viewer: new (el: HTMLElement, file: Uint8Array) => unknown }).Viewer
        if (cancelled || !ref.current) return
        ref.current.innerHTML = ''
        new Viewer(ref.current, buf)
        if (!cancelled) setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="hwp-wrap w-full">
      {state === 'loading' && (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          한글 문서를 불러오는 중…
        </div>
      )}
      {state === 'error' && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          <p>이 한글 파일을 화면에서 열 수 없습니다.</p>
          <p className="mt-1 text-xs text-slate-400">
            한글 5.0(.hwp) 형식만 미리보기를 지원합니다. (.hwpx·암호화·구버전 문서는 미지원)
          </p>
        </div>
      )}
      {/* hwp.js가 페이지를 이 컨테이너에 렌더링 */}
      <div ref={ref} className={`hwp-container w-full ${state === 'ok' ? '' : 'hidden'}`} />
    </div>
  )
}
