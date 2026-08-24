'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StatusBadge, { STATUS_LABEL } from '@/components/StatusBadge'
import ManageSessionsModal from '@/components/ManageSessionsModal'
import { deleteSessionFromProject } from '@/app/admin/sessions/actions'
import ConfirmModalButton from '@/components/ConfirmModalButton'
import { useClientSort, SortTh } from '@/components/client-sort'

export type ProjectSessionRow = {
  id: string
  name: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'
  periodLabel: string
  startDate: string // YYYY-MM-DD ('' 허용)
  endDate: string
  subjectCount: number
  assignmentCount: number
  // 정렬용 담당자 이름(셀 자체는 secretaryCells 노드로 렌더)
  secretaryName: string | null
}

// 분과 설정 표 — 체크박스 상시 + 하단 우측 '분과 정보 변경'(수정·삭제 통합).
// 담당자·관리자 모두 사용(권한은 서버 액션의 assertSessionAccess가 검증).
// 담당자 셀은 페이지(서버)에서 렌더한 노드를 받아 그대로 꽂는다.
export default function ProjectSessionsTable({
  projectId,
  rows,
  secretaryCells,
  emptyLabel,
}: {
  projectId: string
  rows: ProjectSessionRow[]
  // 행 id → 담당자 셀 내용(SessionSecretaryCell 등 서버에서 구성)
  secretaryCells: Record<string, ReactNode>
  emptyLabel: string
}) {
  const router = useRouter()
  // 다중 선택 — 여러 개 선택 시 '분과 정보 변경'에서 평가 기간을 일괄 수정한다(이름은 단건만)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [manageOpen, setManageOpen] = useState(false)
  // 삭제 — 하단 바의 별도 버튼(확인은 모달)
  const [deleting, startDelete] = useTransition()

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
  const selectedRows = rows.filter((r) => selected.has(r.id))
  const remove = () => {
    if (selectedRows.length === 0) return
    startDelete(async () => {
      for (const r of selectedRows) await deleteSessionFromProject(projectId, r.id)
      setSelected(new Set())
      router.refresh()
    })
  }

  // 헤더 클릭 정렬 — 기간은 시작일 기준, 상태는 라벨 가나다순
  const { sortKey, sortDir, toggleSort, sortRows } = useClientSort<
    'name' | 'status' | 'period' | 'subjects' | 'evaluators' | 'secretary'
  >()
  const sorted = sortRows(rows, (r, k) => {
    switch (k) {
      case 'name': return r.name
      case 'status': return STATUS_LABEL[r.status] ?? r.status
      case 'period': return r.startDate
      case 'subjects': return r.subjectCount
      case 'evaluators': return r.assignmentCount
      case 'secretary': return r.secretaryName
    }
  })

  return (
    <div className="space-y-3">
      {/* 분과가 많아도 화면이 커지지 않도록 스크롤(고객 요청 — 설정 화면 축소) */}
      <div className="thin-scrollbar max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">{emptyLabel}</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
                <th className="w-12 px-5 py-3">
                  <button type="button" onClick={toggleAll} aria-label="전체 선택">
                    <PrettyCheck checked={allChecked} />
                  </button>
                </th>
                <SortTh label="분과명" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="담당자" field="secretary" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 기간" field="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 대상 수" field="subjects" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가위원 수" field="evaluators" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 상태" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                // 행 클릭 = 분과 상세로 이동, 선택은 체크박스 클릭으로만
                <tr
                  key={s.id}
                  onClick={() => router.push(`/admin/sessions/${s.id}`)}
                  className={`cursor-pointer border-b border-slate-50 last:border-0 ${
                    selected.has(s.id) ? 'bg-indigo-50' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => toggle(s.id)} aria-label={`${s.name} 선택`} className="block">
                      <PrettyCheck checked={selected.has(s.id)} />
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  {/* 담당자 셀 내부의 배정 UI 클릭이 행 선택으로 번지지 않게 차단 */}
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    {secretaryCells[s.id]}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.periodLabel}</td>
                  {/* 0은 숫자 대신 '미지정'/'미배정'으로 — 아직 준비 안 됐음을 바로 알 수 있게 */}
                  <td className="px-5 py-3 text-slate-600">
                    {s.subjectCount > 0 ? s.subjectCount : <span className="text-xs text-slate-400">미지정</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.assignmentCount > 0 ? s.assignmentCount : <span className="text-xs text-slate-400">미배정</span>}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            {selectedRows.length > 0 && (
              <span className="mr-auto text-sm text-slate-500">
                {selectedRows.length === 1 ? `${selectedRows[0].name} 선택됨` : `${selectedRows.length}개 선택됨`}
              </span>
            )}
            <ConfirmModalButton
              label="삭제"
              pendingLabel="삭제 중…"
              pending={deleting}
              disabled={selectedRows.length === 0}
              title="분과 삭제"
              body={`분과 ${selectedRows.length}개(${selectedRows.map((r) => r.name).join(', ')})를 삭제합니다. 평가 항목·대상·점수·의견서가 함께 삭제되며 되돌릴 수 없습니다.`}
              confirmLabel="삭제"
              onConfirm={remove}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            />
            <button
              type="button"
              disabled={selectedRows.length === 0}
              onClick={() => setManageOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              분과 정보 변경
            </button>
          </div>
        </div>
      )}

      {manageOpen && selectedRows.length > 0 && (
        <ManageSessionsModal
          projectId={projectId}
          rows={selectedRows}
          hideDelete
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
