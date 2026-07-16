'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  presignSubjectUpload,
  registerSubjectDocument,
  uploadSubjectDocument,
} from '@/app/admin/sessions/actions'
import { MAX_UPLOAD_MB, MAX_UPLOAD_BYTES, FALLBACK_MAX_MB, FALLBACK_MAX_BYTES } from '@/lib/upload-limits'

// 평가 대상 자료 업로드 폼 — 브라우저에서 R2로 직접 업로드(presigned PUT)해
// 서버 액션 본문 한도(4MB)에 걸리지 않는다. R2 미설정 환경은 서버 액션으로 폴백.
export default function SubjectUploadForm({ sessionId, companyId }: { sessionId: string; companyId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const busy = progress !== null

  const check = (files: FileList | null): boolean => {
    if (!files || files.length === 0) return true
    const over = Array.from(files).find((f) => f.size > MAX_UPLOAD_BYTES)
    if (over) {
      setError(
        `"${over.name}" 파일이 너무 큽니다 (${(over.size / 1024 / 1024).toFixed(1)}MB). 최대 ${MAX_UPLOAD_MB}MB까지 업로드할 수 있습니다.`,
      )
      return false
    }
    setError(null)
    return true
  }

  const uploadOne = async (file: File) => {
    const presign = await presignSubjectUpload(sessionId, file.name, file.size, file.type)
    if ('error' in presign) throw new Error(presign.error)
    if (presign.direct) {
      // 브라우저 → R2 직접 PUT(서버를 거치지 않음) 후 서버에 등록
      const res = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/pdf' },
        body: file,
      })
      if (!res.ok) throw new Error(`"${file.name}" 저장소 업로드에 실패했습니다. 다시 시도해주세요.`)
      const reg = await registerSubjectDocument(sessionId, companyId, {
        storedName: presign.storedName,
        url: presign.url,
        originalName: file.name,
        mimeType: file.type || 'application/pdf',
      })
      if ('error' in reg) throw new Error(reg.error)
    } else {
      // 폴백(R2 미설정): 서버 액션 경유 — 본문 한도 내에서만 가능
      if (file.size > FALLBACK_MAX_BYTES)
        throw new Error(`이 환경에서는 최대 ${FALLBACK_MAX_MB}MB까지 업로드할 수 있습니다.`)
      const fd = new FormData()
      fd.append('file', file)
      await uploadSubjectDocument(sessionId, companyId, fd)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const files = Array.from(inputRef.current?.files ?? [])
    if (files.length === 0 || !check(inputRef.current?.files ?? null)) return
    setError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(files.length > 1 ? `업로드 중… (${i + 1}/${files.length})` : '업로드 중…')
        await uploadOne(files[i])
      }
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3"
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        multiple
        required
        disabled={busy}
        accept="application/pdf,.pdf"
        onChange={(e) => check(e.target.files)}
        className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
      />
      <button
        disabled={!!error || busy}
        aria-busy={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && (
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 animate-spin" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {progress ?? '업로드'}
      </button>
      <span className="basis-full text-xs text-slate-400">
        예: 사업계획서 · 현장실태 조사서 · 사전검토표 (이 분과 전용으로 저장) ·{' '}
        <span className="font-medium text-slate-500">PDF만 · 최대 {MAX_UPLOAD_MB}MB</span>
      </span>
      {error && <span className="basis-full text-xs font-medium text-rose-600">{error}</span>}
    </form>
  )
}
