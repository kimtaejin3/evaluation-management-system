'use client'

import { useEffect, useState, useTransition } from 'react'
import { renameSection } from '@/app/admin/sessions/actions'

const inputCls = 'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

// 항목(대제목) 이름 일괄 수정. current=null이면 '미분류' 그룹(이름 부여).
export default function EditSectionButton({
  sessionId,
  current,
  label,
}: {
  sessionId: string
  current: string | null
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(current ?? '')
  const [pending, start] = useTransition()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const save = () => {
    start(async () => {
      await renameSection(sessionId, current, name)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setName(current ?? ''); setOpen(true) }}
        className="text-xs text-indigo-600 hover:underline"
      >
        항목 이름 수정
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">항목 이름 수정</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="mb-2 text-xs text-slate-500">현재 항목 <span className="font-medium text-slate-700">{label}</span> 의 모든 세부항목에 적용됩니다.</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save() }}
              placeholder="새 항목 이름 (예: 사업계획)"
              className={`w-full ${inputCls}`}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">취소</button>
              <button type="button" onClick={save} disabled={pending} className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50">
                {pending ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
