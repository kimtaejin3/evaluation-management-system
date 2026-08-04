'use client'

import { useState, useTransition } from 'react'
import { updateProject, deleteProject } from '@/app/admin/projects/actions'

// 사업 정보 변경 — '사업 삭제' 버튼을 대체. 한 버튼에서 정보 수정과 삭제를 모두 처리한다(C3).
export default function ProjectInfoButton({
  projectId,
  name,
  description,
  taskType,
  startDate,
  endDate,
  sessionCount,
}: {
  projectId: string
  name: string
  description: string | null
  taskType: string | null
  startDate: string | null // YYYY-MM-DD
  endDate: string | null
  sessionCount: number
}) {
  const [open, setOpen] = useState(false)
  const [nm, setNm] = useState(name)
  const [type, setType] = useState(taskType ?? '')
  const [start, setStart] = useState(startDate ?? '')
  const [end, setEnd] = useState(endDate ?? '')
  const [desc, setDesc] = useState(description ?? '')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const save = () => {
    setError('')
    const fd = new FormData()
    fd.set('name', nm)
    fd.set('taskType', type)
    fd.set('startDate', start)
    fd.set('endDate', end)
    fd.set('description', desc)
    startTransition(async () => {
      const res = await updateProject(projectId, fd)
      if (res.ok) setOpen(false)
      else setError(res.error ?? '저장에 실패했습니다.')
    })
  }
  const remove = () => {
    startTransition(async () => {
      await deleteProject(projectId) // /admin/projects로 redirect
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50"
      >
        사업 정보 변경
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">사업 정보 변경</h3>

            <div className="mt-4 space-y-3">
              <Field label="사업명">
                <input value={nm} onChange={(e) => setNm(e.target.value)} className={inputCls} />
              </Field>
              <Field label="사업 유형">
                <input value={type} onChange={(e) => setType(e.target.value)} placeholder="예: 지역특화 R&D" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="시작일">
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
                </Field>
                <Field label="종료일">
                  <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="사업 개요">
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className={inputCls} />
              </Field>
            </div>

            {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}

            <div className="mt-6 flex items-center justify-between gap-2">
              {confirmDelete ? (
                <div className="flex w-full flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <span className="text-sm text-rose-700">
                    이 사업을 삭제하면 소속 분과 {sessionCount}개와 그 평가 항목·대상·점수까지 모두 삭제됩니다. 되돌릴 수 없습니다.
                  </span>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-sm text-slate-500">취소</button>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={pending}
                      className="rounded-md bg-rose-600 px-3 py-1 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {pending ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={pending}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    사업 삭제
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={pending || !nm.trim()}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {pending ? '저장 중…' : '저장'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}
