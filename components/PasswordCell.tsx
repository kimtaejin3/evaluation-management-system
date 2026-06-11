'use client'

import { useState } from 'react'

export default function PasswordCell({ value }: { value: string | null }) {
  const [shown, setShown] = useState(false)
  if (!value) return <span className="text-xs text-slate-400">미발급</span>
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm tabular-nums text-slate-700">
        {shown ? value : '•'.repeat(Math.min(value.length, 10))}
      </span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="text-xs text-slate-400 transition hover:text-indigo-600"
        aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
      >
        {shown ? '숨기기' : '보기'}
      </button>
    </span>
  )
}
