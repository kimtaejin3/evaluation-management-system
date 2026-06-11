import type { SessionInsights } from '@/lib/progress'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function DashboardInsights({ data }: { data: SessionInsights }) {
  const ranking = data.rows
  // 편차: 완료 위원 2명 이상(spread!=null)만, 편차 큰 순
  const divergence = data.rows
    .filter((r) => r.spread !== null)
    .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0))

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
      {/* 잠정 순위 */}
      <section className="space-y-2.5">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">잠정 순위 · 평균 점수</h2>
          <span className="text-xs text-slate-400">입력된 점수 기준 · 미완료 제외</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-left font-medium">순위</th>
                <th className="px-4 py-2.5 text-left font-medium">대상</th>
                <th className="px-4 py-2.5 text-right font-medium">평균(잠정)</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">완료 위원</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.subjectId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-left">
                    {r.rank ? (
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
                          r.rank <= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {r.rank}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">–</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">
                    {r.avg !== null ? fmt(r.avg) : <span className="font-normal text-slate-400">집계 전</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">{r.completeCount}명</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">평가 대상이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 위원 간 점수 편차 */}
      <section className="space-y-2.5">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">위원 간 점수 편차</h2>
          <span className="text-xs text-slate-400">완료 위원 2명 이상 · 편차 큰 순</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">대상</th>
                <th className="px-4 py-2.5 text-right font-medium">편차(최고−최저)</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">판정</th>
              </tr>
            </thead>
            <tbody>
              {divergence.map((r) => {
                const big = (r.spread ?? 0) >= 10
                return (
                  <tr key={r.subjectId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">±{fmt(r.spread ?? 0)}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          big ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                        }`}
                      >
                        {big ? '이견 큼' : '안정'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {divergence.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-slate-400">
                    아직 두 명 이상이 완료한 대상이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
