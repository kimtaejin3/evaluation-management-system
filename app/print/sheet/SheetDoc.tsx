const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Item = { id: string; name: string; maxScore: number; value: number | null };
type Sub = { name: string; items: Item[] };
type Grp = { name: string; subs: Sub[] };

export type SheetCriterion = {
  id: string;
  name: string;
  maxScore: number;
  subitem: { name: string | null; group: { name: string | null } } | null;
};

export type SheetDocData = {
  sessionName: string;
  region: string | null;
  taskType: string | null;
  taskName: string | null;
  companyName: string;
  leadResearcher: string | null;
  evaluatorName: string;
  criteria: SheetCriterion[]; // 이미 정렬된 상태
  valueOf: Map<string, number | null>;
  opinionText: string;
  printedDate: string;
};

// 위원별 평가표(K-PASS 양식) 단일 문서. 전체 인쇄 시 여러 개를 페이지 나눔으로 이어 렌더.
export default function SheetDoc({ data, pageBreak = false }: { data: SheetDocData; pageBreak?: boolean }) {
  const { criteria, valueOf } = data;

  const groups: Grp[] = [];
  for (const c of criteria) {
    const gName = c.subitem?.group.name ?? "미분류";
    const sName = c.subitem?.name ?? "";
    let g = groups.find((x) => x.name === gName);
    if (!g) { g = { name: gName, subs: [] }; groups.push(g); }
    let sg = g.subs.find((x) => x.name === sName);
    if (!sg) { sg = { name: sName, items: [] }; g.subs.push(sg); }
    sg.items.push({ id: c.id, name: c.name, maxScore: c.maxScore, value: valueOf.get(c.id) ?? null });
  }

  const maxTotal = criteria.reduce((s, c) => s + c.maxScore, 0);
  const total = criteria.reduce((s, c) => s + (valueOf.get(c.id) ?? 0), 0);
  const filled = criteria.filter((c) => valueOf.get(c.id) != null).length;

  const th = "border border-black bg-slate-200 px-2 py-1 text-center text-sm font-bold print:bg-slate-200";
  const td = "border border-black px-3 py-1 text-sm";

  return (
    <div
      className={`mx-auto max-w-[210mm] rounded-lg bg-white p-8 text-slate-900 shadow-sm ring-1 ring-slate-200 sm:p-12 print:rounded-none print:p-0 print:shadow-none print:ring-0 ${
        pageBreak ? "mt-6 print:mt-0 print:break-before-page" : ""
      }`}
    >
      <h1 className="text-center text-2xl font-extrabold tracking-tight underline decoration-2 underline-offset-[6px]">
        {data.sessionName} 평가표
      </h1>

      {/* 헤더 메타 */}
      <table className="mt-4 w-full border-collapse">
        <tbody>
          <tr>
            <th className={`${th} w-32`}>지역</th>
            <td className={td}>{data.region ?? ""}</td>
            <th className={`${th} w-32`}>과제유형</th>
            <td className={td}>{data.taskType ?? ""}</td>
          </tr>
          <tr>
            <th className={th}>과제명</th>
            <td className={td} colSpan={3}>{data.taskName ?? ""}</td>
          </tr>
          <tr>
            <th className={th}>주관연구개발기관</th>
            <td className={td}>{data.companyName}</td>
            <th className={th}>연구책임자</th>
            <td className={td}>{data.leadResearcher ?? ""}</td>
          </tr>
        </tbody>
      </table>

      {/* 평가표 */}
      <table className="-mt-px w-full border-collapse">
        <thead>
          <tr>
            <th colSpan={2} className={`${th} text-center`}>평가 항목</th>
            <th className={`${th} text-center`}>평가 지표</th>
            <th className={`${th} w-14 text-center`}>배점</th>
            <th className={`${th} w-14 text-center`}>평점</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const groupRowSpan = g.subs.reduce((n, s) => n + Math.max(1, s.items.length), 0) || 1;
            const gTotal = g.subs.reduce((n, s) => n + s.items.reduce((m, i) => m + i.maxScore, 0), 0);
            let groupPlaced = false;
            return g.subs.map((sg) => {
              const subRowSpan = Math.max(1, sg.items.length);
              const subMax = sg.items.reduce((m, i) => m + i.maxScore, 0);
              const subFilled = sg.items.length > 0 && sg.items.every((i) => i.value != null);
              const subScore = sg.items.reduce((m, i) => m + (i.value ?? 0), 0);
              return sg.items.map((c, cIdx) => {
                const cells: React.ReactNode[] = [];
                if (!groupPlaced) {
                  cells.push(
                    <td key="g" rowSpan={groupRowSpan} className={`${td} w-14 px-1 text-center align-middle font-bold`}>
                      {g.name}
                      <div className="font-semibold">({fmt(gTotal)})</div>
                    </td>,
                  );
                  groupPlaced = true;
                }
                if (cIdx === 0) {
                  cells.push(
                    <td key="s" rowSpan={subRowSpan} className={`${td} w-24 px-1.5 text-center align-middle`}>
                      {sg.name || "—"}
                    </td>,
                  );
                }
                cells.push(
                  <td key="c" className={`${td} py-1 align-middle`}>
                    <div className="flex gap-1.5">
                      <span aria-hidden>○</span>
                      <span>{c.name}</span>
                    </div>
                  </td>,
                );
                if (cIdx === 0) {
                  cells.push(
                    <td key="m" rowSpan={subRowSpan} className={`${td} text-center align-middle tabular-nums`}>
                      {fmt(subMax)}
                    </td>,
                    <td key="v" rowSpan={subRowSpan} className={`${td} text-center align-middle font-semibold tabular-nums`}>
                      {subFilled ? fmt(subScore) : ""}
                    </td>,
                  );
                }
                return <tr key={c.id}>{cells}</tr>;
              });
            });
          })}
          {criteria.length === 0 && (
            <tr>
              <td colSpan={5} className={`${td} py-8 text-center text-slate-400`}>평가 항목이 없습니다.</td>
            </tr>
          )}
          <tr className="font-bold">
            <td colSpan={3} className={`${td} text-center`}>합 계</td>
            <td className={`${td} text-center tabular-nums`}>{fmt(maxTotal)}</td>
            <td className={`${td} text-center tabular-nums`}>{filled === criteria.length && criteria.length > 0 ? fmt(total) : ""}</td>
          </tr>
        </tbody>
      </table>

      {/* 평가의견 */}
      <table className="-mt-px w-full border-collapse">
        <tbody>
          <tr>
            <th className={`${th} w-14 px-1 text-center align-middle`}>
              평가
              <br />
              의견
            </th>
            <td className={`${td} align-top`}>
              <div className="min-h-28 whitespace-pre-wrap py-0.5">{data.opinionText || ""}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 하단 — 날짜(좌) · 평가위원 서명(우) */}
      <div className="mt-6 flex items-end justify-between text-sm">
        <span>{data.printedDate}</span>
        <span>
          평가위원 : <span className="font-semibold">{data.evaluatorName}</span>
          <span className="ml-1">(인)</span>
        </span>
      </div>
    </div>
  );
}
