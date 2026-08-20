'use client'

import Link from 'next/link'
import StatusBadge, { STATUS_LABEL } from '@/components/StatusBadge'
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
}

// 사업 실시간 모니터링 표 — 조회 전용(분과 편집은 분과 설정에서).
// 열 구성(회의 결정): 분과명·담당자·평가 기간·평가 대상 수·평가위원 작성 현황·상세·평가 상태.
// 위원 수·의견서 열은 '평가위원 작성 현황(완료/배정)' 하나로 통합.
export default function MonitoringSessionsTable({ rows }: { rows: MonitoringRow[] }) {
  // 헤더 클릭 정렬 — 기간은 시작일 기준, 상태는 라벨 가나다순
  const { sortKey, sortDir, toggleSort, sortRows } = useClientSort<
    'name' | 'secretary' | 'period' | 'subjects' | 'progress' | 'status'
  >()
  const sorted = sortRows(rows, (r, k) => {
    switch (k) {
      case 'name': return r.name
      case 'secretary': return r.secretaryName
      case 'period': return r.startDate
      case 'subjects': return r.subjectCount
      case 'progress': return r.completedEvaluators
      case 'status': return STATUS_LABEL[r.status] ?? r.status
    }
  })

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <SortTh label="분과명" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="담당자" field="secretary" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 기간" field="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가 대상 수" field="subjects" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="평가위원 작성 현황" field="progress" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3 font-medium">상세 평가 진행 상황</th>
                <SortTh label="평가 상태" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-800">{s.name}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.secretaryName ?? <span className="text-xs text-rose-600">미배정</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.period}</td>
                  <td className="px-5 py-3 text-slate-600">{s.subjectCount}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {/* 작성 완료 위원 / 배정 위원 */}
                    <span className="tabular-nums">
                      {s.completedEvaluators}
                      <span className="text-slate-400">/{s.assignedCount}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                    >
                      자세히 보기
                    </Link>
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
    </div>
  )
}
