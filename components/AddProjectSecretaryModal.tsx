'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addSecretaryToProject } from '@/app/admin/projects/actions'

type SecretaryOpt = { id: string; name: string; username: string }

// 사업 참여 담당자 추가 — 담당자 관리의 담당자 풀에서 골라 이 사업에 연결한다.
// 풀에 없는 사람은 '새 담당자 만들기'(전용 페이지)로 생성하면서 자동 참여.
export default function AddProjectSecretaryModal({
  projectId,
  candidates,
}: {
  projectId: string
  candidates: SecretaryOpt[] // 아직 이 사업에 참여하지 않은 담당자들
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

  const add = (fd: FormData) => {
    start(async () => {
      await addSecretaryToProject(projectId, fd)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
      >
        + 담당자 추가
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={add}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">참여 담당자 추가</h3>
                <p className="mt-0.5 text-xs text-slate-400">담당자 풀에서 골라 이 사업에 추가합니다.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
                ✕
              </button>
            </div>

            {candidates.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                추가할 수 있는 담당자가 없습니다. 새 담당자를 만들어 주세요.
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
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.username}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/admin/secretaries/new?projectId=${projectId}`}
                className="text-xs text-indigo-600 hover:underline"
              >
                새 담당자 만들기 →
              </Link>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  disabled={pending || candidates.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
                >
                  {pending ? '처리 중…' : '추가'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
