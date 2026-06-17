'use client'

import { useRef, useState } from 'react'

const MAX_MB = 4
const MAX_BYTES = MAX_MB * 1024 * 1024

// 평가 대상 자료 업로드 폼 — 용량 초과 파일은 전송 전에 차단(서버 액션 본문 한도 초과로 인한 크래시 방지)
export default function SubjectUploadForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const check = (files: FileList | null): boolean => {
    if (!files || files.length === 0) return true
    const over = Array.from(files).find((f) => f.size > MAX_BYTES)
    if (over) {
      setError(`"${over.name}" 파일이 너무 큽니다 (${(over.size / 1024 / 1024).toFixed(1)}MB). 최대 ${MAX_MB}MB까지 업로드할 수 있습니다.`)
      return false
    }
    setError(null)
    return true
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!check(inputRef.current?.files ?? null)) e.preventDefault()
      }}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3"
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        multiple
        required
        accept="application/pdf,.pdf"
        onChange={(e) => check(e.target.files)}
        className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
      />
      <button
        disabled={!!error}
        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
      >
        업로드
      </button>
      <span className="basis-full text-xs text-slate-400">
        예: 사업계획서 · 현장실태 조사서 · 사전검토표 (이 심사 전용으로 저장) · <span className="font-medium text-slate-500">PDF만 · 최대 {MAX_MB}MB</span>
      </span>
      {error && <span className="basis-full text-xs font-medium text-rose-600">{error}</span>}
    </form>
  )
}
