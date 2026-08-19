'use client'

import { useEffect, useState, useTransition } from 'react'
import { setSessionStatus } from '@/app/admin/sessions/actions'
import { canCloseSession } from '@/lib/session-rules'

type Status = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'

// 상태는 배경·테두리 없이 색 글씨로만 구분
const MAP: Record<Status, { label: string; cls: string }> = {
  DRAFT: { label: '준비', cls: 'text-slate-500' },
  IN_PROGRESS: { label: '진행중', cls: 'text-blue-600' },
  CLOSED: { label: '완료', cls: 'text-emerald-600' },
}

const FLOW: { key: Status; label: string; desc: string }[] = [
  { key: 'DRAFT', label: '준비', desc: '항목·대상·위원을 설정합니다.' },
  { key: 'IN_PROGRESS', label: '진행중', desc: '평가위원이 점수를 입력합니다.' },
  { key: 'CLOSED', label: '완료', desc: '점수가 잠기고 결과가 확정됩니다.' },
]

export default function SessionStatusControl({
  sessionId,
  status,
  eventDate,
  readOnly = false,
}: {
  sessionId: string
  status: Status
  eventDate: string | null
  // 담당자 모드 — 변경 모달 없이 배지 표시만. 단 준비(DRAFT)일 때는 '평가 시작' 버튼으로
  // 진행중 전환만 허용(마감은 집계 결과 제출→관리자 검토 완료로 처리).
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Status>(status)
  const [pending, startTransition] = useTransition()
  const ev = eventDate ? new Date(eventDate) : null
  const closable = canCloseSession(ev)

  const openModal = () => {
    setSelected(status) // 열 때마다 현재 상태로 초기화
    setOpen(true)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const badge = MAP[status]

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className={`text-sm font-medium whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
        {status === 'DRAFT' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('평가를 시작할까요? 분과가 진행중으로 바뀌고 평가위원이 점수를 입력할 수 있습니다.')) return
              change('IN_PROGRESS')
            }}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? '처리 중…' : '평가 시작'}
          </button>
        )}
      </span>
    )
  }

  const change = (next: Status) => {
    startTransition(async () => {
      await setSessionStatus(sessionId, next)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap transition hover:opacity-70 ${badge.cls}`}
        title="클릭하여 진행 상태 변경"
      >
        {badge.label}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-60" aria-hidden>
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">진행 상태 변경</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-2" role="radiogroup" aria-label="진행 상태 선택">
              {FLOW.map((f) => {
                const isSel = selected === f.key
                const isCur = status === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    onClick={() => setSelected(f.key)}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      isSel ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isSel ? 'border-indigo-600' : 'border-slate-300'}`}>
                      {isSel && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium ${isSel ? 'text-indigo-700' : 'text-slate-700'}`}>{f.label}</span>
                        {isCur && <span className="text-xs font-medium text-slate-400">현재</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">{f.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {selected === 'CLOSED' && !closable && ev && (
              <p className="mt-3 text-xs text-amber-600">평가 일시({ev.toLocaleDateString('ko-KR')}) 이후에 완료할 수 있습니다.</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => change(selected)}
                disabled={pending || selected === status || (selected === 'CLOSED' && !closable)}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {pending ? '저장 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
