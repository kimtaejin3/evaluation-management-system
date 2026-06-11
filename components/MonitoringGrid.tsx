import type { ProgressData, CellState } from '@/lib/progress'

const label: Record<CellState, string> = { done: '완료', partial: '입력중', none: '미작성' }

const blockCls: Record<CellState, string> = {
  done: 'border-[var(--gov-primary)] bg-[var(--gov-primary)]',
  partial: 'border-dashed border-indigo-400 bg-indigo-50',
  none: 'border-slate-200 bg-slate-50',
}

function Block({ state, className = '' }: { state: CellState; className?: string }) {
  return <span className={`block rounded-sm border ${blockCls[state]} ${className}`} title={label[state]} />
}

export default function MonitoringGrid({ data }: { data: ProgressData }) {
  const totalSub = data.subjects.length
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
            {data.rows.map((r, i) => {
              const done = r.cells.filter((c) => c.state === 'done').length
              return (
                <tr key={r.userId} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-800">
                    <span className="mr-1.5 text-slate-400">#{i + 1}</span>
                    {r.name}
                  </td>
                  {r.cells.map((c) => (
                    <td key={c.subjectId} className="px-2 py-2">
                      <Block state={c.state} className="mx-auto h-5 w-full max-w-[88px]" />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-center font-semibold tabular-nums text-slate-700">
                    {done}/{totalSub}
                  </td>
                </tr>
              )
            })}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={totalSub + 2} className="px-5 py-10 text-center text-slate-400">
                  배정된 평가위원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        {(['none', 'partial', 'done'] as CellState[]).map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5">
            <Block state={st} className="h-3.5 w-6" />
            {label[st]}
          </span>
        ))}
      </div>
    </div>
  )
}
