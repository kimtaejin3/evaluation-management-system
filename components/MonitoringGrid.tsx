import type { ProgressData } from "@/lib/progress";
import MonitoringCell from "@/components/MonitoringCell";

// 행 = 대상(기업), 열 = 평가위원. 각 칸은 상태 텍스트(입력완료/입력중/미입력) + 클릭 시 항목 현황 모달.
export default function MonitoringGrid({ data, sessionId }: { data: ProgressData; sessionId: string }) {
  const evaluators = data.rows; // userId, name, isChair, cells(대상 순서와 동일)
  const subjects = data.subjects;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">위원 및 대상 모니터링</h2>
        <span className="text-xs text-slate-400">상태를 클릭하면 항목별 입력 현황을 볼 수 있습니다.</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="sticky left-0 z-20 w-px whitespace-nowrap border-b border-r border-slate-200 bg-white px-4 py-2.5 text-left font-medium">
                대상 \ 위원
              </th>
              {evaluators.map((e) => (
                <th key={e.userId} className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-center font-medium">
                  {e.name}
                  {e.isChair && <span className="ml-1 text-xs text-indigo-600">(위원장)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, si) => (
              <tr key={s.id} className="group">
                <td className="sticky left-0 z-10 w-px whitespace-nowrap border-b border-r border-slate-100 bg-white px-4 py-2.5 font-medium text-slate-800 group-last:border-b-0">
                  {s.name}
                </td>
                {evaluators.map((e) => (
                  <td key={e.userId} className="border-b border-slate-100 px-2 py-2 text-center group-last:border-b-0">
                    <MonitoringCell cell={e.cells[si]} subjectName={s.name} evaluatorName={e.name} sessionId={sessionId} evaluatorId={e.userId} />
                  </td>
                ))}
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={evaluators.length + 1} className="px-5 py-10 text-center text-slate-400">
                  평가 대상이 없습니다.
                </td>
              </tr>
            )}
            {subjects.length > 0 && evaluators.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-slate-400">
                  배정된 평가위원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
