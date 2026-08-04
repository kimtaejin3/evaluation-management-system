'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import SortableTh from '@/components/SortableTh'
import { deleteSessionFromProject } from '@/app/admin/sessions/actions'

export type MonitoringRow = {
  id: string
  name: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'
  period: string
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
  sort,
  dir,
}: {
  projectId: string
  rows: MonitoringRow[]
  isMaster: boolean
  sort?: string
  dir: 'asc' | 'desc'
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, start] = useTransition()
  const basePath = `/admin/projects/${projectId}/monitoring`

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
  const removeSelected = () => {
    start(async () => {
      for (const r of selectedRows) await deleteSessionFromProject(projectId, r.id)
      setSelected(new Set())
      setConfirmOpen(false)
      router.refresh()
    })
  }

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
                <SortableTh label="분과명" field="name" sort={sort} dir={dir} basePath={basePath} />
                <th className="px-5 py-3 font-medium">평가 상태</th>
                <SortableTh label="평가 기간" field="period" sort={sort} dir={dir} basePath={basePath} />
                <th className="px-5 py-3 font-medium">담당자</th>
                <th className="px-5 py-3 font-medium">평가 대상 수</th>
                <th className="px-5 py-3 font-medium">평가위원 수</th>
                <th className="px-5 py-3 font-medium">완료 위원</th>
                <th className="px-5 py-3 font-medium">평가 의견서</th>
                <th className="px-5 py-3 font-medium">상세 평가 진행 상황</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
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
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-300"
          >
            분과 삭제
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">분과 삭제</h3>
            <p className="mt-2 text-sm text-slate-600">선택한 분과 {selectedRows.length}개를 삭제합니다. 되돌릴 수 없습니다.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedRows.map((r) => (
                <span key={r.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{r.name}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">각 분과의 평가 항목·대상·점수·의견서가 함께 삭제됩니다.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                취소
              </button>
              <button type="button" onClick={removeSelected} disabled={pending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40">
                {pending ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
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
