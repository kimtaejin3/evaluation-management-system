'use client'

import { useEffect, useRef, useState } from 'react'
import ScoreForm from './ScoreForm'
import type { SheetData } from '@/lib/evaluate-data'

const bar = 'rounded bg-slate-200/70'

// 실제 ScoreForm 레이아웃과 동일한 골격의 스켈레톤(로딩 시 덜컹임 방지)
function SheetSkeleton() {
  return (
    <div className="animate-pulse">
      {/* 헤더(네비) */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-6 py-2.5">
          <div className={`h-8 w-28 ${bar}`} />
          <div className="h-5 w-12 rounded-full bg-slate-200/70" />
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <div className={`h-4 w-14 ${bar}`} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-8 w-10 ${bar}`} />
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <div className={`h-8 w-24 ${bar}`} />
        </div>
      </div>
      {/* 본문 */}
      <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
        {/* 목록·세션명·서류 / 현재 점수 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-16 ${bar}`} />
            <div className={`h-4 w-40 ${bar}`} />
            <div className={`h-7 w-24 ${bar}`} />
          </div>
          <div className={`h-4 w-24 ${bar}`} />
        </div>
        {/* 섹션 제목 */}
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 ${bar}`} />
          <div className={`h-6 w-40 ${bar}`} />
        </div>
        {/* 항목 카드 */}
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className={`h-4 w-48 ${bar}`} />
                <div className={`h-3 w-64 ${bar}`} />
              </div>
              <div className={`h-3 w-10 ${bar}`} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="h-14 rounded-lg bg-slate-200/70" />
              ))}
            </div>
            <div className="mt-2.5 flex justify-end">
              <div className={`h-3 w-16 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 점수 입력 화면 CSR 컨테이너.
// - 데이터는 /api/evaluate/sheet 에서 클라이언트 fetch(스켈레톤 즉시)
// - 대상 전환은 라우트 이동 없이 클라이언트 fetch + 캐시 → 재방문 즉시
export default function ScoreSheetClient({
  sessionId,
  subjectId,
  initialStep,
}: {
  sessionId: string
  subjectId: string
  initialStep?: string
}) {
  const [cur, setCur] = useState(subjectId)
  const [stepFor, setStepFor] = useState<string | undefined>(initialStep)
  const [data, setData] = useState<SheetData | null>(null)
  const [error, setError] = useState(false)
  const cache = useRef<Map<string, SheetData>>(new Map())

  useEffect(() => {
    const cached = cache.current.get(cur)
    if (cached) { setData(cached); setError(false); return }
    let ignore = false
    setData(null)
    setError(false)
    fetch(`/api/evaluate/sheet?sessionId=${encodeURIComponent(sessionId)}&subjectId=${encodeURIComponent(cur)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: SheetData) => {
        if (ignore) return
        cache.current.set(cur, d)
        setData(d)
      })
      .catch(() => { if (!ignore) setError(true) })
    return () => { ignore = true }
  }, [cur, sessionId])

  // 대상 전환(라우트 이동 없이) — URL만 동기화해 새로고침 시에도 유지
  const handleSelect = (id: string, step: string) => {
    setStepFor(step)
    setCur(id)
    const q = step ? `?step=${encodeURIComponent(step)}` : ''
    window.history.pushState(null, '', `/evaluate/${sessionId}/${id}${q}`)
  }

  if (error) {
    return <div className="mx-auto max-w-5xl px-6 py-12 text-center text-sm text-slate-400">평가 정보를 불러오지 못했습니다.</div>
  }
  if (!data) {
    return <SheetSkeleton />
  }
  return (
    <ScoreForm
      key={cur}
      sessionId={sessionId}
      subjectId={cur}
      subjectName={data.subjectName}
      sessionName={data.sessionName}
      evaluatorName={data.evaluatorName}
      isChair={data.isChair}
      eventDate={data.eventDate}
      progress={data.progress}
      documents={data.documents}
      criteria={data.criteria}
      initialComment={data.initialComment}
      subjects={data.subjects}
      otherScores={data.otherScores}
      otherPending={data.otherPending}
      initialStep={stepFor}
      onSelectSubject={handleSelect}
      onDirty={() => cache.current.delete(cur)}
    />
  )
}
