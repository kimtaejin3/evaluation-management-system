'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ackCriteria } from '@/app/admin/sessions/actions'

// 담당자용 — 관리자가 작성한 사업 공통 평가항목을 '확인'하는 패널.
// 확인하면 criteriaAckAt이 기록되고, 관리자는 사업 평가항목 페이지에서 분과별 확인 현황을 본다.
export default function CriteriaAckPanel({
  sessionId,
  ackAt,
  hasCriteria,
}: {
  sessionId: string
  ackAt: string | null // ISO 문자열(직렬화). null = 미확인
  hasCriteria: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (ackAt) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <span aria-hidden>✓</span>
        <span className="font-medium">평가항목 확인 완료</span>
        <span className="text-xs text-emerald-600">
          {new Date(ackAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
      <p className="text-sm text-slate-700">
        관리자가 작성한 사업 공통 평가항목입니다. 내용을 검토한 뒤 <b>확인</b>을 눌러주세요.
      </p>
      <button
        type="button"
        disabled={pending || !hasCriteria}
        onClick={() =>
          start(async () => {
            await ackCriteria(sessionId)
            router.refresh()
          })
        }
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
        title={hasCriteria ? undefined : '아직 등록된 평가항목이 없습니다'}
      >
        {pending ? '처리 중…' : '확인'}
      </button>
    </div>
  )
}
