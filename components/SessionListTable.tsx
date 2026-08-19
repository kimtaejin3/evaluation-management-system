'use client'

import Link from 'next/link'
import StatusBadge, { STATUS_LABEL, type SessionStatus } from '@/components/StatusBadge'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import { useClientSort, SortTh } from '@/components/client-sort'

export type SessionListRow = {
  id: string
  name: string
  status: SessionStatus
  criterionCount: number
  subjectCount: number
  assignmentCount: number
  periodLabel: string
  startDate: string // YYYY-MM-DD ('' 허용) — 기간 정렬 기준
}

// 분과 관리 목록 표 — 헤더 클릭 정렬(클라이언트). 행 클릭 시 관리 화면 진입.
export default function SessionListTable({ rows }: { rows: SessionListRow[] }) {
  const { sortKey, sortDir, toggleSort, sortRows } = useClientSort<
    'name' | 'status' | 'criteria' | 'subjects' | 'evaluators' | 'period'
  >()
  const sorted = sortRows(rows, (r, k) => {
    switch (k) {
      case 'name': return r.name
      case 'status': return STATUS_LABEL[r.status] ?? r.status
      case 'criteria': return r.criterionCount
      case 'subjects': return r.subjectCount
      case 'evaluators': return r.assignmentCount
      case 'period': return r.startDate
    }
  })

  const thCls = 'px-5 py-3 font-semibold'
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="table-grid w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr className="border-b border-slate-200">
            <SortTh label="분과명" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className={thCls} />
            <SortTh label="상태" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className={thCls} />
            <SortTh label="항목" field="criteria" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className={thCls} />
            <SortTh label="대상" field="subjects" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className={thCls} />
            <SortTh label="위원" field="evaluators" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className={thCls} />
            <SortTh label="평가 기간" field="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className={thCls} />
            <th className={thCls}>동작</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.id} className="relative border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-800">
                {/* 행 전체 클릭 → 관리 진입 */}
                <Link href={`/admin/sessions/${s.id}`} aria-label={`${s.name} 관리`} className="absolute inset-0" />
                {s.name}
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={s.status} />
              </td>
              <td className="px-5 py-3 text-slate-600">{s.criterionCount}</td>
              <td className="px-5 py-3 text-slate-600">{s.subjectCount}</td>
              <td className="px-5 py-3 text-slate-600">{s.assignmentCount}</td>
              <td className="px-5 py-3 text-slate-500">{s.periodLabel || '—'}</td>
              <td className="px-5 py-3">
                <div className="relative z-10 flex items-center gap-3">
                  <Link href={`/admin/sessions/${s.id}`} className="text-[var(--gov-primary)] hover:underline">
                    관리
                  </Link>
                  <DeleteSessionButton sessionId={s.id} sessionName={s.name} />
                </div>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                조회된 분과가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
