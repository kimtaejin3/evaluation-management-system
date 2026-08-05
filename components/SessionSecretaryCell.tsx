'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignSecretaryToSession, unassignSessionSecretary } from '@/app/admin/projects/actions'

type SecretaryOpt = { id: string; name: string; username: string }

// 분과 목록의 '담당자' 셀(관리자 전용) — 해제하면 곧바로 새 담당자 배정 모달이 열리고,
// 미배정 분과는 '배정' 버튼으로 같은 모달을 연다.
export default function SessionSecretaryCell({
  projectId,
  sessionId,
  sessionName,
  secretaryName,
  secretaries,
}: {
  projectId: string
  sessionId: string
  sessionName: string
  secretaryName: string | null
  secretaries: SecretaryOpt[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 해제 → 즉시 새 담당자 배정 모달 열기
  const unassign = () => {
    start(async () => {
      await unassignSessionSecretary(projectId, sessionId)
      router.refresh()
      setOpen(true)
    })
  }

  const assign = (fd: FormData) => {
    start(async () => {
      await assignSecretaryToSession(projectId, fd)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {secretaryName ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-slate-700">{secretaryName}</span>
          <button
            type="button"
            disabled={pending}
            onClick={unassign}
            className="text-xs whitespace-nowrap text-slate-400 hover:text-slate-600 hover:underline disabled:opacity-50"
          >
            {pending ? '처리 중…' : '해제'}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-rose-700 transition hover:bg-rose-100"
        >
          미배정
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={assign}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">담당자 배정</h3>
                <p className="mt-0.5 text-xs text-slate-400">{sessionName}의 담당자를 선택하세요.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
                ✕
              </button>
            </div>

            <input type="hidden" name="sessionId" value={sessionId} />
            {secretaries.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                등록된 담당자가 없습니다. &lsquo;담당자 관리&rsquo;에서 먼저 담당자를 등록해 주세요.
              </p>
            ) : (
              <select
                name="userId"
                required
                defaultValue=""
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="" disabled>
                  담당자 선택
                </option>
                {secretaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.username}
                  </option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                취소
              </button>
              <button
                disabled={pending || secretaries.length === 0}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {pending ? '처리 중…' : '배정'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
