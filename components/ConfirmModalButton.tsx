'use client'

import { useEffect, useState } from 'react'

// 확인 모달이 뜨는 버튼 — 네이티브 confirm() 대신 스타일 모달로 통일.
// (배경 클릭으로는 닫히지 않고, ESC·취소·✕로만 닫힌다)
export default function ConfirmModalButton({
  label,
  pendingLabel = '처리 중…',
  pending = false,
  disabled = false,
  title,
  body,
  confirmLabel,
  onConfirm,
  className,
  buttonTitle,
}: {
  label: string
  pendingLabel?: string
  pending?: boolean
  disabled?: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  className: string
  buttonTitle?: string
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" disabled={disabled || pending} title={buttonTitle} onClick={() => setOpen(true)} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 transition hover:text-slate-600" aria-label="닫기">✕</button>
            </div>
            <p className="mt-2 text-sm text-slate-500">{body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                취소
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false)
                  onConfirm()
                }}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
