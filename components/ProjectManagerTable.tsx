'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateProject, deleteProjects } from '@/app/admin/projects/actions'
import { useClientSort, SortTh } from '@/components/client-sort'
import ConfirmModalButton from '@/components/ConfirmModalButton'

export type ManagedProject = {
  id: string
  name: string
  description: string | null
  taskType: string | null
  startDate: string // YYYY-MM-DD ('' 허용)
  endDate: string
  periodLabel: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'
  sessionCount: number
  inProgressCount: number
  secretaryNames: string[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '준비중', cls: 'bg-slate-200 text-slate-700 ring-slate-300' },
  IN_PROGRESS: { label: '진행중', cls: 'bg-blue-100 text-blue-800 ring-blue-300' },
  CLOSED: { label: '마감', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
}

// 사업 관리 표 — 체크박스 상시(단일 선택) + 하단 우측 '사업 정보 변경'(수정·삭제 통합).
// 카드 그리드를 대체(관리 화면 공통 규칙과 통일). '정보 변경'은 한 건씩 하는 작업이라 하나만 고른다.
export default function ProjectManagerTable({ projects }: { projects: ManagedProject[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  // 삭제 — 하단 바의 별도 버튼(확인은 모달)
  const [deleting, startDelete] = useTransition()

  const toggle = (id: string) => setSelected((prev) => (prev === id ? null : id))
  const selectedProject = projects.find((p) => p.id === selected) ?? null
  const remove = () => {
    if (!selectedProject) return
    startDelete(async () => {
      await deleteProjects([selectedProject.id])
      setSelected(null)
      router.refresh()
    })
  }

  // 헤더 클릭 정렬 — 상태는 라벨 가나다순, 기간은 시작일 기준
  const { sortKey, sortDir, toggleSort, sortRows } = useClientSort<
    'name' | 'status' | 'period' | 'sessions' | 'secretaries'
  >()
  const sorted = sortRows(projects, (p, k) => {
    switch (k) {
      case 'name': return p.name
      case 'status': return STATUS[p.status].label
      case 'period': return p.startDate
      case 'sessions': return p.sessionCount
      case 'secretaries': return p.secretaryNames.join(', ')
    }
  })

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {projects.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            등록된 사업이 없습니다. ‘사업 등록’으로 시작하세요.
          </p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="w-12 px-5 py-3" aria-label="선택" />
                <SortTh label="사업명" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="상태" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="사업 기간" field="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="분과" field="sessions" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="담당자" field="secretaries" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const st = STATUS[p.status]
                return (
                  <tr
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`cursor-pointer border-b border-slate-50 last:border-0 ${
                      selected === p.id ? 'bg-indigo-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <PrettyCheck checked={selected === p.id} />
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{p.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.periodLabel}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.sessionCount}개{p.inProgressCount > 0 ? ` · 진행중 ${p.inProgressCount}` : ''}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.secretaryNames.length === 0 ? (
                        <span className="text-xs text-slate-400">미배정</span>
                      ) : (
                        p.secretaryNames.join(', ')
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {projects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            {selectedProject && <span className="mr-auto text-sm text-slate-500">{selectedProject.name} 선택됨</span>}
            <ConfirmModalButton
              label="삭제"
              pendingLabel="삭제 중…"
              pending={deleting}
              disabled={!selectedProject}
              title="사업 삭제"
              body={
                selectedProject
                  ? `‘${selectedProject.name}’ 사업을 삭제합니다.${
                      selectedProject.sessionCount > 0
                        ? ` 소속 분과 ${selectedProject.sessionCount}개와 평가 항목·대상·점수·의견서가 함께 삭제되며`
                        : ' 이 작업은'
                    } 되돌릴 수 없습니다.`
                  : ''
              }
              confirmLabel="삭제"
              onConfirm={remove}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            />
            <button
              type="button"
              disabled={!selectedProject}
              onClick={() => setManageOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              사업 정보 변경
            </button>
          </div>
        </div>
      )}

      {manageOpen && selectedProject && (
        <ManageProjectsModal
          project={selectedProject}
          onClose={() => setManageOpen(false)}
          onDone={() => {
            setManageOpen(false)
            setSelected(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// 사업 정보 변경 모달 — 사업명·유형·기간·개요 수정(단일 사업). 삭제는 표 하단의 별도 버튼.
function ManageProjectsModal({
  project,
  onClose,
  onDone,
}: {
  project: ManagedProject
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState(project.name)
  const [type, setType] = useState(project.taskType ?? '')
  const [start, setStart] = useState(project.startDate)
  const [end, setEnd] = useState(project.endDate)
  const [desc, setDesc] = useState(project.description ?? '')
  const [error, setError] = useState('')
  const [pending, startTx] = useTransition()

  const save = () => {
    setError('')
    const fd = new FormData()
    fd.set('name', name)
    fd.set('taskType', type)
    fd.set('startDate', start)
    fd.set('endDate', end)
    fd.set('description', desc)
    startTx(async () => {
      const res = await updateProject(project.id, fd)
      if (res.ok) onDone()
      else setError(res.error ?? '저장에 실패했습니다.')
    })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">사업 정보 변경</h3>

        <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">사업명</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">사업 유형</span>
              <input value={type} onChange={(e) => setType(e.target.value)} placeholder="예: 지역특화 R&D" className={inputCls} />
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
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">사업 개요</span>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={inputCls} />
            </label>
          </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">닫기</button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? '저장 중…' : '정보 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

function PrettyCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition ${
        checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
      }`}
      aria-hidden
    >
      {checked && (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 10 3.5 3.5L15 6" />
        </svg>
      )}
    </span>
  )
}
