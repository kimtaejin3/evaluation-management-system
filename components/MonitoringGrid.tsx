import type { ProgressData } from "@/lib/progress";
import MonitoringCell from "@/components/MonitoringCell";

// 와이어프레임 상태 체계
type WireState = "none" | "partial" | "done" | "locked";

const SWATCH: Record<WireState, string> = {
  none: "border border-slate-300 bg-white", // 미평가
  partial: "border border-dashed border-slate-400 bg-white", // 입력 중
  done: "border border-slate-900 bg-slate-900", // 완료
  locked: "border border-slate-300 bg-slate-300", // 제출잠금
};

const LEGEND: { state: WireState; label: string }[] = [
  { state: "none", label: "미평가" },
  { state: "partial", label: "입력 중" },
  { state: "done", label: "완료" },
  { state: "locked", label: "제출잠금" },
];

export default function MonitoringGrid({ data }: { data: ProgressData }) {
  const totalSub = data.subjects.length;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          위원 및 대상 모니터링
        </h2>
        <span className="text-xs text-slate-400">
          모든 칸 입력 완료 시 자동 알림 · 현장 상태판과 동일 데이터
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="sticky left-0 z-20 w-px whitespace-nowrap border-b border-r border-slate-200 bg-white px-3 py-2.5 text-left font-medium">
                위원 \ 대상
              </th>
              {data.subjects.map((s) => (
                <th
                  key={s.id}
                  className="w-32 border-b border-slate-200 px-2 py-2.5 text-center font-medium"
                  title={s.name}
                >
                  <span className="mx-auto block max-w-[120px] truncate">{s.name}</span>
                </th>
              ))}
              <th className="sticky right-0 z-20 w-px whitespace-nowrap border-b border-l border-slate-200 bg-white px-3 py-2.5 text-center font-medium">
                진행률
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => {
              const done = r.cells.filter((c) => c.state === "done").length;
              return (
                <tr key={r.userId} className="group">
                  <td className="sticky left-0 z-10 w-px whitespace-nowrap border-b border-r border-slate-100 bg-white px-3 py-2 font-medium text-slate-800 group-last:border-b-0">
                    <span className="mr-1.5 text-slate-400">#{i + 1}</span>
                    {r.name}
                  </td>
                  {r.cells.map((c) => (
                    <td
                      key={c.subjectId}
                      className="border-b border-slate-100 px-1.5 py-2 group-last:border-b-0"
                    >
                      <MonitoringCell cell={c} />
                    </td>
                  ))}
                  <td className="sticky right-0 z-10 w-px whitespace-nowrap border-b border-l border-slate-100 bg-white px-3 py-2 text-center font-semibold tabular-nums text-slate-700 group-last:border-b-0">
                    {done}/{totalSub}
                  </td>
                </tr>
              );
            })}
            {data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={totalSub + 2}
                  className="px-5 py-10 text-center text-slate-400"
                >
                  배정된 평가위원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {LEGEND.map((l) => (
          <span key={l.state} className="inline-flex items-center gap-1.5">
            <span className={`h-3.5 w-4 rounded-[2px] ${SWATCH[l.state]}`} />
            {l.label}
          </span>
        ))}
      </div>
    </section>
  );
}
