const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// 행 = 채점 단위(unit). 통합(퉁) 단위는 지표들을 한 칸에 글머리표로 표시하고 점수 1개.
type Row = { id: string; label: string; indicators: string[]; maxScore: number };
type Sub = { key: string; name: string; items: Row[] };
type Grp = { name: string; subs: Sub[] };

export type ScoreUnitRow = {
  unitId: string;
  kind: "criterion" | "subitem";
  groupName: string;
  subitemId: string;
  subitemName: string;
  label: string;
  indicators: string[];
  maxScore: number;
};

export type SubjectScoreData = {
  subjectName: string;
  sessionName: string;
  evaluators: { id: string; name: string }[];
  units: ScoreUnitRow[]; // 이미 정렬됨
  scoreOf: Map<string, number>; // `${evaluatorId}:${unitId}` → 점수
  printedDate: string;
};

// 기업(대상) 1건에 대한 위원별 점수표 단일 문서.
export default function SubjectScoreDoc({ data, pageBreak = false }: { data: SubjectScoreData; pageBreak?: boolean }) {
  const { evaluators, units, scoreOf } = data;

  const groups: Grp[] = [];
  for (const u of units) {
    const gName = u.groupName || "미분류";
    let g = groups.find((x) => x.name === gName);
    if (!g) { g = { name: gName, subs: [] }; groups.push(g); }
    let sg = g.subs.find((x) => x.key === u.subitemId);
    if (!sg) { sg = { key: u.subitemId, name: u.subitemName, items: [] }; g.subs.push(sg); }
    sg.items.push({ id: u.unitId, label: u.label, indicators: u.indicators, maxScore: u.maxScore });
  }

  const maxTotal = units.reduce((s, u) => s + u.maxScore, 0);
  const totals = evaluators.map((ev) => {
    const entered = units.filter((u) => scoreOf.has(`${ev.id}:${u.unitId}`));
    const sum = entered.reduce((s, u) => s + (scoreOf.get(`${ev.id}:${u.unitId}`) ?? 0), 0);
    return { id: ev.id, sum, complete: entered.length === units.length && units.length > 0 };
  });
  const completeSums = totals.filter((t) => t.complete).map((t) => t.sum);
  const avg = completeSums.length ? completeSums.reduce((a, b) => a + b, 0) / completeSums.length : null;

  const th = "border border-black bg-slate-200 px-2 py-1 text-center text-sm font-bold print:bg-slate-200";
  const td = "border border-black px-3 py-1 text-sm";

  return (
    <div
      className={`mx-auto max-w-[277mm] rounded-lg bg-white p-8 text-slate-900 shadow-sm ring-1 ring-slate-200 sm:p-10 print:rounded-none print:p-0 print:shadow-none print:ring-0 ${
        pageBreak ? "mt-6 print:mt-0 print:break-before-page" : ""
      }`}
    >
      <h1 className="text-center text-xl font-extrabold tracking-tight">{data.subjectName} · 위원별 점수</h1>
      <p className="mt-1 text-center text-sm text-slate-500 print:text-slate-700">{data.sessionName}</p>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={`${th} text-center`}>평가 항목</th>
            <th className={`${th} text-center`}>세부항목</th>
            <th className={`${th} text-center`}>평가 지표</th>
            <th className={`${th} w-14 text-center`}>배점</th>
            {evaluators.map((ev) => (
              <th key={ev.id} className={`${th} w-16 text-center`}>{ev.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const groupRowSpan = g.subs.reduce((n, s) => n + Math.max(1, s.items.length), 0) || 1;
            let groupPlaced = false;
            return g.subs.map((sg) => {
              const subRowSpan = Math.max(1, sg.items.length);
              return sg.items.map((c, cIdx) => {
                const cells: React.ReactNode[] = [];
                if (!groupPlaced) {
                  cells.push(<td key="g" rowSpan={groupRowSpan} className={`${td} text-center align-middle font-bold`}>{g.name}</td>);
                  groupPlaced = true;
                }
                if (cIdx === 0) cells.push(<td key="s" rowSpan={subRowSpan} className={`${td} text-center align-middle`}>{sg.name || "—"}</td>);
                cells.push(
                  <td key="c" className={`${td} align-middle`}>
                    {c.indicators.length > 0 ? (
                      <ul className="space-y-0.5">
                        {c.indicators.map((t, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span aria-hidden>○</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      c.label
                    )}
                  </td>,
                  <td key="m" className={`${td} text-center align-middle tabular-nums`}>{c.maxScore}</td>,
                );
                evaluators.forEach((ev) => {
                  const v = scoreOf.get(`${ev.id}:${c.id}`);
                  cells.push(<td key={`v-${ev.id}`} className={`${td} text-center align-middle tabular-nums`}>{v != null ? fmt(v) : ""}</td>);
                });
                return <tr key={c.id}>{cells}</tr>;
              });
            });
          })}
          {units.length === 0 && (
            <tr>
              <td colSpan={4 + evaluators.length} className={`${td} py-8 text-center text-slate-400`}>평가 항목이 없습니다.</td>
            </tr>
          )}
          <tr className="font-bold">
            <td colSpan={3} className={`${td} text-center`}>합 계</td>
            <td className={`${td} text-center tabular-nums`}>{fmt(maxTotal)}</td>
            {evaluators.map((ev) => {
              const t = totals.find((x) => x.id === ev.id);
              return <td key={ev.id} className={`${td} text-center tabular-nums`}>{t && t.complete ? fmt(t.sum) : ""}</td>;
            })}
          </tr>
          <tr className="font-bold">
            <td colSpan={4} className={`${td} text-center`}>평균(완료 위원)</td>
            <td colSpan={evaluators.length || 1} className={`${td} text-center tabular-nums`}>{avg != null ? fmt(avg) : "-"}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 text-right text-sm">{data.printedDate}</div>
    </div>
  );
}
