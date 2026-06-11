import type { ProgressData } from '@/lib/progress'

type CellState = 'done' | 'partial' | 'none'
const label: Record<CellState, string> = { done: '완료', partial: '입력중', none: '미입력' }

function Dot({ state }: { state: CellState }) {
  if (state === 'partial') {
    // 입력중: 브랜드 컬러 링 + 작은 중심점(반쯤 채워진 느낌)
    return (
      <span className="relative inline-block h-2.5 w-2.5 rounded-full ring-1 ring-[var(--gov-primary)]" title="입력중">
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--gov-primary)]" />
      </span>
    )
  }
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${state === 'done' ? 'bg-[var(--gov-primary)]' : 'bg-slate-200'}`} title={label[state]} />
}

export default function MonitoringGrid({ data }: { data: ProgressData }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">위원 \ 대상</th>
              {data.subjects.map((s) => (
                <th key={s.id} className="px-3 py-3 text-center font-medium">{s.name}</th>
              ))}
              <th className="px-4 py-3 text-center font-medium">완료율</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.userId} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                {r.cells.map((c) => (
                  <td key={c.subjectId} className="px-3 py-3 text-center">
                    <Dot state={c.state} />
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-medium text-slate-700">{r.donePct}%</td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr><td colSpan={data.subjects.length + 2} className="px-5 py-10 text-center text-slate-400">배정된 평가위원이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><Dot state="done" /> 완료</span>
        <span className="inline-flex items-center gap-1.5"><Dot state="partial" /> 입력중</span>
        <span className="inline-flex items-center gap-1.5"><Dot state="none" /> 미입력</span>
      </div>
    </div>
  )
}
