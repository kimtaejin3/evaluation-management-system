'use client'

import { useEffect, useRef, useState } from 'react'
import ScoreForm from './ScoreForm'
import type { SheetData } from '@/lib/evaluate-data'

const bar = 'rounded bg-slate-200/70'

// 실제 ScoreForm(3단) 레이아웃과 동일한 골격의 스켈레톤(로딩 시 덜컹임 방지)
function SheetSkeleton() {
  return (
    <div className="animate-pulse">
      {/* 헤더 */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-1.5 px-6 py-2.5">
          <div className={`h-8 w-28 ${bar}`} />
          <div className={`ml-auto h-4 w-32 ${bar}`} />
        </div>
      </div>
      {/* 목록 줄 */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-2">
          <div className={`h-7 w-16 ${bar}`} />
          <div className={`h-4 w-40 ${bar}`} />
        </div>
        <div className={`h-4 w-16 ${bar}`} />
      </div>
      {/* 3단 */}
      <div className="mx-auto max-w-[1600px] px-6 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,1.75fr)_320px]">
          <div className={`h-[70vh] ${bar}`} />
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3"><div className={`h-4 w-40 ${bar}`} /></div>
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`h-4 w-8 ${bar}`} />
                  <div className={`h-4 flex-1 ${bar}`} />
                  <div className={`h-8 w-36 ${bar}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className={`h-24 ${bar}`} />
            <div className={`h-56 ${bar}`} />
          </div>
        </div>
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
