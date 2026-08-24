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

// 상태는 배경·테두리 없이 색 글씨로만 구분
const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '준비중', cls: 'text-slate-500' },
  IN_PROGRESS: { label: '진행중', cls: 'text-blue-600' },
  CLOSED: { label: '마감', cls: 'text-emerald-600' },
}

// 사업 관리 표 — 체크박스 상시(다중 선택) + 하단 우측 '삭제'·'사업 정보 변경'.
// 카드 그리드를 대체(관리 화면 공통 규칙과 통일). 여러 개 선택 시 정보 변경은 기간만 일괄 수정.
export default function ProjectManagerTable({ projects }: { projects: ManagedProject[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [manageOpen, setManageOpen] = useState(false)
  // 삭제 — 하단 바의 별도 버튼(확인은 모달)
  const [deleting, startDelete] = useTransition()

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allChecked = projects.length > 0 && projects.every((p) => selected.has(p.id))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(projects.map((p) => p.id)))
  const selectedProjects = projects.filter((p) => selected.has(p.id))
  const totalSessions = selectedProjects.reduce((n, p) => n + p.sessionCount, 0)
  const remove = () => {
    if (selectedProjects.length === 0) return
    startDelete(async () => {
      await deleteProjects(selectedProjects.map((p) => p.id))
      setSelected(new Set())
      router.refresh()
    })
  }

  // 사업 개요 전체 보기(표에서는 한 줄로 잘라 보여준다)
  const [descOf, setDescOf] = useState<ManagedProject | null>(null)
  // 헤더 클릭 정렬 — 상태는 라벨 가나다순, 기간은 시작일 기준
  const { sortKey, sortDir, toggleSort, sortRows } = useClientSort<
    'name' | 'description' | 'status' | 'period' | 'secretaries'
  >()
  const sorted = sortRows(projects, (p, k) => {
    switch (k) {
      case 'name': return p.name
      case 'description': return p.description ?? ''
      case 'status': return STATUS[p.status].label
      case 'period': return p.startDate
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
                <th className="w-12 px-5 py-3">
                  <button type="button" onClick={toggleAll} aria-label="전체 선택">
                    <PrettyCheck checked={allChecked} />
                  </button>
                </th>
                <SortTh label="사업명" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="사업 개요" field="description" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="사업 기간" field="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="담당자" field="secretaries" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="상태" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const st = STATUS[p.status]
                return (
                  // 행 클릭 = 상세(분과 설정)로 이동, 선택은 체크박스 클릭으로만
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/admin/projects/${p.id}`)}
                    className={`cursor-pointer border-b border-slate-50 last:border-0 ${
                      selected.has(p.id) ? 'bg-indigo-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => toggle(p.id)} aria-label={`${p.name} 선택`} className="block">
                        <PrettyCheck checked={selected.has(p.id)} />
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="max-w-xs px-5 py-3">
                      {p.description ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDescOf(p)
                          }}
                          title="클릭해서 전체 보기"
                          className="block w-full truncate text-left text-slate-600 hover:text-indigo-700"
                        >
                          {p.description}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">{p.periodLabel}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.secretaryNames.length === 0 ? (
                        <span className="text-xs text-slate-400">미배정</span>
                      ) : (
                        p.secretaryNames.join(', ')
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium whitespace-nowrap ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 사업 개요 전체 보기 */}
      {descOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setDescOf(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-slate-900">{descOf.name}</h3>
              <button
                type="button"
                onClick={() => setDescOf(null)}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <p className="text-xs font-medium text-slate-400">사업 개요</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{descOf.description}</p>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            {selectedProjects.length > 0 && (
              <span className="mr-auto text-sm text-slate-500">
                {selectedProjects.length === 1 ? `${selectedProjects[0].name} 선택됨` : `${selectedProjects.length}개 선택됨`}
              </span>
            )}
            <ConfirmModalButton
              label="삭제"
              pendingLabel="삭제 중…"
              pending={deleting}
              disabled={selectedProjects.length === 0}
              title="사업 삭제"
              body={`사업 ${selectedProjects.length}개(${selectedProjects.map((p) => p.name).join(', ')})를 삭제합니다.${
                totalSessions > 0 ? ` 소속 분과 ${totalSessions}개와 평가 항목·대상·점수·의견서가 함께 삭제되며` : ' 이 작업은'
              } 되돌릴 수 없습니다.`}
              confirmLabel="삭제"
              onConfirm={remove}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            />
            <button
              type="button"
              disabled={selectedProjects.length === 0}
              onClick={() => setManageOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              사업 정보 변경
            </button>
          </div>
        </div>
      )}

      {manageOpen && selectedProjects.length > 0 && (
        <ManageProjectsModal
          projects={selectedProjects}
          onClose={() => setManageOpen(false)}
          onDone={() => {
            setManageOpen(false)
            setSelected(new Set())
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// 사업 정보 변경 모달 — 1개 선택 시 사업명·유형·기간·개요 수정, 여러 개 선택 시 기간만 일괄 변경.
// 삭제는 표 하단의 별도 버튼.
function ManageProjectsModal({
  projects,
  onClose,
  onDone,
}: {
  projects: ManagedProject[]
  onClose: () => void
  onDone: () => void
}) {
  const single = projects.length === 1 ? projects[0] : null
  // 일괄 모드 초기값 — 선택 사업의 값이 모두 같으면 그 값, 다르면 빈 칸
  const common = (get: (p: ManagedProject) => string) =>
    projects.length > 0 && projects.every((p) => get(p) === get(projects[0])) ? get(projects[0]) : ''
  const [name, setName] = useState(single?.name ?? '')
  const [type, setType] = useState(single?.taskType ?? '')
  const [start, setStart] = useState(single ? single.startDate : common((p) => p.startDate))
  const [end, setEnd] = useState(single ? single.endDate : common((p) => p.endDate))
  const [desc, setDesc] = useState(single?.description ?? '')
  const [error, setError] = useState('')
  const [pending, startTx] = useTransition()

  const save = () => {
    setError('')
    startTx(async () => {
      for (const p of projects) {
        const fd = new FormData()
        // 일괄 모드에서는 기간만 바꾸고 이름·유형·개요는 기존 값 유지.
        // 날짜 빈 칸은 각 사업의 기존 값 유지(한쪽만 바꿔도 안전)
        fd.set('name', single ? name : p.name)
        fd.set('taskType', single ? type : (p.taskType ?? ''))
        fd.set('startDate', single ? start : start || p.startDate)
        fd.set('endDate', single ? end : end || p.endDate)
        fd.set('description', single ? desc : (p.description ?? ''))
        const res = await updateProject(p.id, fd)
        if (!res.ok) {
          setError(`${p.name}: ${res.error ?? '저장에 실패했습니다.'}`)
          return
        }
      }
      onDone()
    })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">사업 정보 변경</h3>

        {single ? (
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
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">선택한 사업 {projects.length}개:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {projects.map((p) => (
                  <span key={p.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{p.name}</span>
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
            <p className="text-xs text-slate-400">사업 기간이 선택한 사업 전체에 일괄 적용됩니다. 사업명·유형·개요는 한 개씩 선택했을 때만 수정할 수 있습니다.</p>
          </div>
        )}

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
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
