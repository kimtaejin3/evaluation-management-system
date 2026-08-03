'use client'

import { useEffect, useState, useTransition } from 'react'
import { deleteProject } from '@/app/admin/projects/actions'

export default function DeleteProjectButton({
  projectId,
  projectName,
  sessionCount,
}: {
  projectId: string
  projectName: string
  sessionCount: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const confirm = () => {
    startTransition(async () => {
      await deleteProject(projectId)
      // deleteProject는 /admin/projects로 redirect
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
      >
        사업 삭제
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">사업 삭제</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{projectName}</span> 사업을 삭제합니다.
            </p>
            {sessionCount > 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">
                소속 분과 <span className="font-medium text-slate-700">{sessionCount}개</span>는 삭제되지 않고 <span className="font-medium">‘미분류’</span> 상태로 남습니다(분과의 평가 항목·대상·점수는 보존). 다만 사업-분과 연결과 담당자 배정 정보는 사라집니다.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">이 사업에는 소속 분과가 없습니다.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
              >
                {pending ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
