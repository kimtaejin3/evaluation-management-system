'use client'

import { useState, useTransition } from 'react'
import { saveChairSummary } from '@/app/evaluate/actions'

export default function ChairSummaryForm({ sessionId, initial }: { sessionId: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const onSave = () => {
    setStatus('idle')
    const fd = new FormData()
    fd.set('summary', text)
    start(async () => {
      const res = await saveChairSummary(sessionId, fd)
      setStatus(res?.ok ? 'saved' : 'error')
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">분과 총괄평가 (위원장)</span>
        <span className="text-xs text-slate-400">{text.length}자</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus('idle') }}
        rows={6}
        placeholder="분과 전체에 대한 위원장 총괄 의견을 작성하세요. (대상 간 비교·종합 판단·권고 등)"
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="mt-3 flex items-center justify-end gap-3">
        {status === 'saved' && <span className="text-xs text-emerald-600">저장되었습니다.</span>}
        {status === 'error' && <span className="text-xs text-rose-600">저장에 실패했습니다.</span>}
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? '저장 중…' : '총괄평가 저장'}
        </button>
      </div>
    </div>
  )
}
