'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StatusBadge, { STATUS_LABEL } from '@/components/StatusBadge'
import ManageSessionsModal from '@/components/ManageSessionsModal'
import { useClientSort, SortTh } from '@/components/client-sort'

export type MonitoringRow = {
  id: string
  name: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'
  period: string
  startDate: string // YYYY-MM-DD
  endDate: string
  secretaryName: string | null
  subjectCount: number
  assignedCount: number
  completedEvaluators: number
  written: number
  expected: number
}

// 사업 실시간 모니터링 표 — 체크박스 상시(마스터) + 하단 우측 '분과 삭제'.
// 행별 삭제 버튼 대신 선택 방식으로 통일(고객 요청, C1).
export default function MonitoringSessionsTable({
  projectId,
  rows,
  isMaster,
}: {
  projectId: string
  rows: MonitoringRow[]
  isMaster: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [manageOpen, setManageOpen] = useState(false)

  // 헤더 클릭 정렬 — 기간은 시작일 기준, 상태는 라벨 가나다순
  const { sortKey, sortDir, toggleSort, sortRows } = useClientSort<
    'name' | 'status' | 'period' | 'secretary' | 'subjects' | 'evaluators' | 'completed' | 'opinions'
  >()
  const sorted = sortRows(rows, (r, k) => {
    switch (k) {
      case 'name': return r.name
      case 'status': return STATUS_LABEL[r.status] ?? r.status
      case 'period': return r.startDate
      case 'secretary': return r.secretaryName
      case 'subjects': return r.subjectCount
      case 'evaluators': return r.assignedCount
      case 'completed': return r.completedEvaluators
      case 'opinions': return r.written
    }
  })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allChecked = rows.length > 0 && selected.size === rows.length
  const toggleAll = () =>
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))))

  const selectedRows = rows.filter((r) => selected.has(r.id))

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {isMaster && (
                  <th className="w-12 px-5 py-3">
                    <button type="button" onClick={toggleAll} aria-label="전체 선택">
                      <PrettyCheck checked={allChecked} />
                    </button>
                  </th>
                )}
                <SortTh label="분과명" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 상태" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 기간" field="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="담당자" field="secretary" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 대상 수" field="subjects" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가위원 수" field="evaluators" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="완료 위원" field="completed" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 의견서" field="opinions" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3 font-medium">상세 평가 진행 상황</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr
                  key={s.id}
                  onClick={isMaster ? () => toggle(s.id) : undefined}
                  className={`border-b border-slate-50 last:border-0 ${
                    isMaster ? `cursor-pointer ${selected.has(s.id) ? 'bg-indigo-50' : 'hover:bg-slate-50/60'}` : 'hover:bg-slate-50/60'
                  }`}
                >
                  {isMaster && (
                    <td className="px-5 py-3">
                      <PrettyCheck checked={selected.has(s.id)} />
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-800">{s.name}</span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.period}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.secretaryName ?? <span className="text-xs text-rose-600">미배정</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.subjectCount}</td>
                  <td className="px-5 py-3 text-slate-600">{s.assignedCount}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.completedEvaluators}/{s.assignedCount}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <span className="tabular-nums">
                      {s.written}
                      {s.expected > 0 && <span className="text-slate-400">/{s.expected}</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                    >
                      자세히 보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isMaster && rows.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          {selected.size > 0 && <span className="mr-auto text-sm text-slate-500">{selected.size}개 선택됨</span>}
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setManageOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            분과 정보 변경
          </button>
        </div>
      )}

      {manageOpen && (
        <ManageSessionsModal
          projectId={projectId}
          rows={selectedRows}
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
