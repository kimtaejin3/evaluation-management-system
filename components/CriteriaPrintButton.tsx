'use client'

import { usePrintPreview } from './usePrintPreview'

// 평가항목(평가지)을 새 탭에서 인쇄. 관리자·간사 공통.
export default function CriteriaPrintButton({ sessionId }: { sessionId: string }) {
  const { print } = usePrintPreview()
  return (
    <button
      type="button"
      onClick={() => print(`/print/criteria?sessionId=${sessionId}`)}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
    >
      인쇄
    </button>
  )
}
