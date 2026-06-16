'use client'

import { useEffect, useState, useTransition } from 'react'
import { deleteSession } from '@/app/admin/sessions/actions'

export default function DeleteSessionButton({ sessionId, sessionName }: { sessionId: string; sessionName: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const confirm = () => {
    startTransition(async () => {
      await deleteSession(sessionId)
      setOpen(false)
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-rose-600 hover:underline">
        삭제
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">심사 삭제</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{sessionName}</span> 심사를 삭제합니다. 평가 항목·대상·배정·입력된 점수가 모두 함께 삭제되며 <span className="font-semibold text-rose-600">되돌릴 수 없습니다.</span>
            </p>
            <p className="mt-1.5 text-xs text-slate-400">이 심사 전용으로 올린 자료(PDF)도 함께 삭제됩니다. 공통(전 심사) 자료는 보존됩니다.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
                취소
              </button>
              <button type="button" onClick={confirm} disabled={pending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-40">
                {pending ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
