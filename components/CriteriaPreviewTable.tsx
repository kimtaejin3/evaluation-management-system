import { groupTotal } from "@/lib/criteria";

type LeafDTO = { id: string; name: string; maxScore: number };
type SubitemDTO = { id: string; name: string; criteria: LeafDTO[] };
type GroupDTO = { id: string; name: string; maxScore: number; subitems: SubitemDTO[] };

// 구성된 평가지를 읽기전용 표로 보여줌 (미리보기 · 마감된 분과 공용)
export default function CriteriaPreviewTable({ groups }: { groups: GroupDTO[] }) {
  const grand = groups.reduce(
    (s, g) => s + groupTotal(g.subitems.flatMap((x) => x.criteria)),
    0,
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="table-grid w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="px-4 py-2.5 font-medium">평가항목</th>
            <th className="px-4 py-2.5 font-medium">세부항목</th>
            <th className="px-4 py-2.5 font-medium">평가지표</th>
            <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">배점</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const gTotal = groupTotal(g.subitems.flatMap((x) => x.criteria));
            const groupRowSpan =
              g.subitems.reduce((n, s) => n + Math.max(1, s.criteria.length), 0) || 1;
            const groupCell = (
              <td
                rowSpan={groupRowSpan}
                className="border-r border-slate-100 px-4 py-3 align-top font-semibold text-slate-800"
              >
                {g.name}
                <span className="mt-0.5 block text-xs font-normal text-slate-400">
                  합계 {gTotal} / 목표 {g.maxScore}
                </span>
              </td>
            );

            if (g.subitems.length === 0) {
              return (
                <tr key={g.id} className="border-b border-slate-100 last:border-0">
                  {groupCell}
                  <td colSpan={3} className="px-4 py-3 text-xs text-slate-400">
                    세부항목이 없습니다.
                  </td>
                </tr>
              );
            }

            return g.subitems.map((s, sIdx) => {
              const subRowSpan = Math.max(1, s.criteria.length);
              if (s.criteria.length === 0) {
                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    {sIdx === 0 && groupCell}
                    <td className="border-r border-slate-100 px-4 py-3 align-top text-slate-700">
                      {s.name}
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-xs text-slate-400">
                      평가지표가 없습니다.
                    </td>
                  </tr>
                );
              }
              return s.criteria.map((c, cIdx) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  {sIdx === 0 && cIdx === 0 && groupCell}
                  {cIdx === 0 && (
                    <td
                      rowSpan={subRowSpan}
                      className="border-r border-slate-100 px-4 py-3 align-top text-slate-700"
                    >
                      {s.name}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-700">{c.name}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                    {c.maxScore}
                  </td>
                </tr>
              ));
            });
          })}
          {groups.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                등록된 평가 항목이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
        {groups.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td colSpan={3} className="px-4 py-2.5 text-right text-slate-600">
                총 배점
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{grand}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
