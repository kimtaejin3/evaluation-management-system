'use client'

import { useEffect, useState } from 'react'
import CriterionForm, { type CriterionInit } from './CriterionForm'

export default function EditCriterionButton({ sessionId, criterion }: { sessionId: string; criterion: CriterionInit }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-indigo-600 hover:underline">수정</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">세부항목 수정</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <CriterionForm sessionId={sessionId} criterion={criterion} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
