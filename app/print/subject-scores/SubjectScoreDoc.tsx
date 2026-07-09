const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Leaf = { id: string; name: string; maxScore: number };
type Sub = { name: string; items: Leaf[] };
type Grp = { name: string; subs: Sub[] };

export type ScoreCriterion = {
  id: string;
  name: string;
  maxScore: number;
  subitem: { name: string | null; group: { name: string | null } } | null;
};

export type SubjectScoreData = {
  subjectName: string;
  sessionName: string;
  evaluators: { id: string; name: string }[];
  criteria: ScoreCriterion[]; // 이미 정렬됨
  scoreOf: Map<string, number>; // `${evaluatorId}:${criterionId}` → 점수
  printedDate: string;
};

// 기업(대상) 1건에 대한 위원별 점수표 단일 문서.
export default function SubjectScoreDoc({ data, pageBreak = false }: { data: SubjectScoreData; pageBreak?: boolean }) {
  const { evaluators, criteria, scoreOf } = data;

  const groups: Grp[] = [];
  for (const c of criteria) {
    const gName = c.subitem?.group.name ?? "미분류";
    const sName = c.subitem?.name ?? "";
    let g = groups.find((x) => x.name === gName);
    if (!g) { g = { name: gName, subs: [] }; groups.push(g); }
    let sg = g.subs.find((x) => x.name === sName);
    if (!sg) { sg = { name: sName, items: [] }; g.subs.push(sg); }
    sg.items.push({ id: c.id, name: c.name, maxScore: c.maxScore });
  }

  const maxTotal = criteria.reduce((s, c) => s + c.maxScore, 0);
  const totals = evaluators.map((ev) => {
    const entered = criteria.filter((c) => scoreOf.has(`${ev.id}:${c.id}`));
    const sum = entered.reduce((s, c) => s + (scoreOf.get(`${ev.id}:${c.id}`) ?? 0), 0);
    return { id: ev.id, sum, complete: entered.length === criteria.length && criteria.length > 0 };
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
                  <td key="c" className={`${td} align-middle`}>{c.name}</td>,
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
          {criteria.length === 0 && (
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
