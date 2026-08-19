'use client'

import { useState, useTransition } from 'react'
import { deleteSessionFromProject, updateSession } from '@/app/admin/sessions/actions'

export type ManageSessionRow = {
  id: string
  name: string
  startDate: string // YYYY-MM-DD ('' 허용)
  endDate: string
}

// 분과 정보 변경 모달 — 1개 선택 시 분과명·평가 기간 수정, 여러 개 선택 시 평가 기간 일괄 변경.
// (분과명은 한 개씩 선택했을 때만 수정 가능) 사업 모니터링·분과 설정 두 화면에서 공용.
export default function ManageSessionsModal({
  projectId,
  rows,
  onClose,
  onDone,
  hideDelete = false,
}: {
  projectId: string
  rows: ManageSessionRow[]
  onClose: () => void
  onDone: () => void
  // 분과 설정처럼 삭제를 모달 밖(표 하단 버튼)에서 처리하는 화면은 모달 안 삭제를 숨긴다
  hideDelete?: boolean
}) {
  const single = rows.length === 1 ? rows[0] : null
  // 일괄 모드 초기값 — 선택 분과의 값이 모두 같으면 그 값, 다르면 빈 칸
  const common = (get: (r: ManageSessionRow) => string) =>
    rows.length > 0 && rows.every((r) => get(r) === get(rows[0])) ? get(rows[0]) : ''
  const [name, setName] = useState(single?.name ?? '')
  const [start, setStart] = useState(single ? single.startDate : common((r) => r.startDate))
  const [end, setEnd] = useState(single ? single.endDate : common((r) => r.endDate))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTx] = useTransition()

  const save = () => {
    setError('')
    startTx(async () => {
      for (const r of rows) {
        const fd = new FormData()
        // 분과명은 단건일 때만 수정 — 일괄 모드에서는 기존 이름 유지.
        // 날짜 빈 칸은 각 분과의 기존 값 유지(한쪽만 바꿔도 안전)
        fd.set('name', single ? name : r.name)
        fd.set('startDate', single ? start : start || r.startDate)
        fd.set('endDate', single ? end : end || r.endDate)
        const res = await updateSession(r.id, fd)
        if (!res.ok) {
          setError(`${r.name}: ${res.error ?? '저장에 실패했습니다.'}`)
          return
        }
      }
      onDone()
    })
  }
  const remove = () => {
    startTx(async () => {
      for (const r of rows) await deleteSessionFromProject(projectId, r.id)
      onDone()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">분과 정보 변경</h3>

        {single ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">분과명</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">시작일</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">종료일</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">선택한 분과 {rows.length}개:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rows.map((r) => (
                  <span key={r.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{r.name}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">시작일 (일괄)</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">종료일 (일괄)</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
              </label>
            </div>
            <p className="text-xs text-slate-400">평가 기간이 선택한 분과 전체에 일괄 적용됩니다. 분과명은 한 개씩 선택했을 때만 수정할 수 있습니다.</p>
          </div>
        )}

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {!hideDelete && confirmDelete ? (
            <div className="flex w-full flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <span className="text-sm text-rose-700">분과 {rows.length}개를 삭제합니다. 평가 항목·대상·점수·의견서가 함께 삭제되며 되돌릴 수 없습니다.</span>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-sm text-slate-500">취소</button>
                <button type="button" onClick={remove} disabled={pending} className="rounded-md bg-rose-600 px-3 py-1 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                  {pending ? '삭제 중…' : '삭제'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {!hideDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  삭제
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">닫기</button>
                <button
                  type="button"
                  onClick={save}
                  disabled={pending || (single ? !name.trim() : !start && !end)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {pending ? '저장 중…' : '정보 저장'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
