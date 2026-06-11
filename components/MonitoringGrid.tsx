import type { ProgressData, Cell, CellState } from '@/lib/progress'

const label: Record<CellState, string> = { done: '완료', partial: '입력중', none: '미작성' }

// 셀 = 항목별 세그먼트 (항목 1개 = 블록 1개)
function CellBlocks({ cell }: { cell: Cell }) {
  if (cell.total === 0) {
    return <span className="mx-auto block h-5 w-full max-w-[88px] rounded-sm border border-slate-200 bg-slate-50" />
  }
  const tip = cell.items.map((it) => `${it.done ? '✓' : '·'} ${it.name}`).join('\n')
  return (
    <span className="mx-auto flex h-5 w-full max-w-[88px] gap-0.5" title={tip}>
      {cell.items.map((it) => (
        <span
          key={it.id}
          className={`flex-1 rounded-[2px] border ${
            it.done ? 'border-[var(--gov-primary)] bg-[var(--gov-primary)]' : 'border-slate-200 bg-slate-50'
          }`}
        />
      ))}
    </span>
  )
}

export default function MonitoringGrid({ data }: { data: ProgressData }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-2.5 text-left font-medium">위원 \ 대상</th>
              {data.subjects.map((s) => (
                <th key={s.id} className="px-2 py-2.5 text-center font-medium">{s.name}</th>
              ))}
              <th className="px-4 py-2.5 text-center font-medium">진행률</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r.userId} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-800">
                  <span className="mr-1.5 text-slate-400">#{i + 1}</span>
                  {r.name}
                </td>
                {r.cells.map((c) => (
                  <td key={c.subjectId} className="px-2 py-2">
                    <CellBlocks cell={c} />
                  </td>
                ))}
                <td className="px-4 py-2 text-center font-semibold tabular-nums text-slate-700">
                  {r.doneItems}/{r.totalItems}
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={data.subjects.length + 2} className="px-5 py-10 text-center text-slate-400">
                  배정된 평가위원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[2px] border border-[var(--gov-primary)] bg-[var(--gov-primary)]" />
          입력 완료 항목
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[2px] border border-slate-200 bg-slate-50" />
          미입력 항목
        </span>
        <span className="text-slate-400">· 셀 안의 칸 1개 = 평가 항목 1개 (마우스를 올리면 항목명 표시)</span>
      </div>
    </div>
  )
}
