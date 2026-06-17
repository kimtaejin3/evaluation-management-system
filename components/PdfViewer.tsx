'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// pdf.js 워커 — 번들된 worker를 사용(별도 CDN 의존 없음)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PdfViewer({ id, embed = false }: { id: string; embed?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [showAll, setShowAll] = useState(false)
  const [width, setWidth] = useState(0)
  const [error, setError] = useState(false)

  const file = useMemo(() => `/api/documents/${id}`, [id])
  // Document re-mount 방지를 위한 안정적 options
  const options = useMemo(() => ({}), [])

  // 컨테이너 폭 측정 → 페이지 폭 맞춤(scale 곱)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pageWidth = width > 0 ? Math.max(240, (width - 24) * scale) : undefined

  const btn =
    'rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40'

  return (
    <div className="flex flex-col gap-2">
      {/* 툴바 */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5">
          {!showAll && (
            <>
              <button type="button" className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                ◀
              </button>
              <span className="min-w-16 text-center text-sm tabular-nums text-slate-600">
                {numPages ? `${page} / ${numPages}` : '—'}
              </span>
              <button type="button" className={btn} onClick={() => setPage((p) => Math.min(numPages, p + 1))} disabled={page >= numPages}>
                ▶
              </button>
            </>
          )}
          <button type="button" className={`${btn} ml-1`} onClick={() => setShowAll((v) => !v)}>
            {showAll ? '한 쪽씩' : `전체 ${numPages || ''}쪽`}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={btn} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))} disabled={scale <= 0.5}>
            −
          </button>
          <span className="min-w-12 text-center text-sm tabular-nums text-slate-600">{Math.round(scale * 100)}%</span>
          <button type="button" className={btn} onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))} disabled={scale >= 3}>
            +
          </button>
          <button type="button" className={`${btn} ml-1`} onClick={() => setScale(1)} disabled={scale === 1}>
            맞춤
          </button>
          <a href={file} target="_blank" rel="noreferrer" className={`${btn} ml-1`}>
            새 탭
          </a>
        </div>
      </div>

      {/* 문서 영역 */}
      <div ref={wrapRef} className={`overflow-auto rounded-lg border border-slate-200 bg-slate-200/50 p-3 ${embed ? 'h-[calc(100vh-5rem)]' : 'h-[80vh]'}`}>
        {error ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
            PDF를 불러올 수 없습니다.
          </div>
        ) : (
          <Document
            file={file}
            options={options}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages)
              setError(false)
            }}
            onLoadError={() => setError(true)}
            loading={<div className="py-20 text-center text-sm text-slate-400">PDF 불러오는 중…</div>}
            className="flex flex-col items-center gap-3"
          >
            {showAll ? (
              Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i}
                  pageNumber={i + 1}
                  width={pageWidth}
                  className="shadow-sm"
                  renderAnnotationLayer
                  renderTextLayer
                />
              ))
            ) : (
              <Page pageNumber={page} width={pageWidth} className="shadow-sm" renderAnnotationLayer renderTextLayer />
            )}
          </Document>
        )}
      </div>
    </div>
  )
}
