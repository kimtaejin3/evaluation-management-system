'use client'

import { useState, useTransition } from 'react'
import { applyCriteriaTemplate } from '@/app/admin/sessions/actions'

export default function ApplyTemplateButton({
  sessionId,
  templateKey,
  label,
  hasExisting,
}: {
  sessionId: string
  templateKey: string
  label: string
  hasExisting: boolean
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const onClick = () => {
    if (hasExisting && !confirm('기존 평가 항목을 모두 대체합니다. 계속할까요?')) return
    setMsg(null)
    start(async () => {
      const res = await applyCriteriaTemplate(sessionId, templateKey)
      if (res?.error) setMsg(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
      >
        {pending ? '적용 중…' : `${label} 적용`}
      </button>
      {msg && <span className="text-xs text-rose-600">{msg}</span>}
    </div>
  )
}
