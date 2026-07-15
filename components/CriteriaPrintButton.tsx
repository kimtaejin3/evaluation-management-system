'use client'

import { usePrintPreview } from './usePrintPreview'

// 평가항목(평가지)을 새 탭에서 인쇄. 관리자·간사 공통.
// projectId(과제 페이지) 또는 sessionId(분과 페이지) 중 하나로 호출한다.
export default function CriteriaPrintButton({
  sessionId,
  projectId,
}: {
  sessionId?: string
  projectId?: string
}) {
  const { print } = usePrintPreview()
  const qs = projectId ? `projectId=${projectId}` : `sessionId=${sessionId}`
  return (
    <button
      type="button"
      onClick={() => print(`/print/criteria?${qs}`)}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
    >
      인쇄
    </button>
  )
}
