import Link from "next/link";
import CompanyLogo from "@/components/CompanyLogo";
import type { SessionInsights } from "@/lib/progress";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function DashboardInsights({
  data,
  sessionId,
}: {
  data: SessionInsights;
  sessionId: string;
}) {
  const ranking = data.rows;
  // 편차: 모든 대상 표시(편차 큰 순), 2명 미만 완료(집계 전)는 뒤로
  const divergence = [...data.rows].sort((a, b) => {
    if (a.spread === null && b.spread === null) return 0;
    if (a.spread === null) return 1;
    if (b.spread === null) return -1;
    return b.spread - a.spread;
  });

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
      {/* 잠정 순위 */}
      <section className="space-y-2.5">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            잠정 순위 · 평균 점수
          </h2>
          <span className="text-xs text-slate-400">
            입력된 점수 기준 · 미완료 제외
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-left font-medium">
                  순위
                </th>
                <th className="px-4 py-2.5 text-left font-medium">대상</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  평균(잠정)
                </th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">
                  완료 위원
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr
                  key={r.subjectId}
                  className="h-12 border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 text-left">
                    {r.rank ? (
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums bg-slate-100 text-slate-600
                        `}
                      >
                        {r.rank}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">–</span>
                    )}
                  </td>
                  <td className="px-4 font-medium text-slate-800">
                    <Link
                      href={`/admin/sessions/${sessionId}/subjects#subject-${r.subjectId}`}
                      className="inline-flex items-center gap-2 hover:text-indigo-700 hover:underline"
                    >
                      <CompanyLogo name={r.name} className="h-6 w-6 text-[10px]" />
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 text-right font-semibold tabular-nums text-slate-900">
                    {r.avg !== null ? (
                      fmt(r.avg)
                    ) : (
                      <span className="font-normal text-slate-400">
                        집계 전
                      </span>
                    )}
                  </td>
                  <td className="px-4 text-right tabular-nums text-slate-500">
                    {r.completeCount}명
                  </td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    평가 대상이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 위원 간 점수 편차 */}
      <section className="space-y-2.5">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            위원 간 점수 편차
          </h2>
          <span className="text-xs text-slate-400">
            완료 위원 2명 이상부터 산출 · 편차 큰 순
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">대상</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  편차(최고−최저)
                </th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">
                  판정
                </th>
              </tr>
            </thead>
            <tbody>
              {divergence.map((r) => {
                const pending = r.spread === null;
                const big = (r.spread ?? 0) >= 10;
                return (
                  <tr
                    key={r.subjectId}
                    className="h-12 border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 font-medium text-slate-800">
                      {r.name}
                    </td>
                    <td className="px-4 text-right font-semibold tabular-nums text-slate-900">
                      {pending ? (
                        <span className="font-normal text-slate-400">집계 전</span>
                      ) : (
                        `±${fmt(r.spread ?? 0)}`
                      )}
                    </td>
                    <td className="px-4 text-right">
                      {pending ? (
                        <span className="text-xs text-slate-300">–</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            big
                              ? "bg-amber-50 text-amber-700 ring-amber-200"
                              : "bg-slate-100 text-slate-500 ring-slate-200"
                          }`}
                        >
                          {big ? "편차 높음" : "안정"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {divergence.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    평가 대상이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
