const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// 세부항목 블록 — 지표별 모드: lines=지표(각각 점수), 통합(퉁) 모드: lines=설명용 지표, 점수는 1개.
type Sub = { key: string; name: string; lines: string[]; maxScore: number; filled: boolean; score: number };
type Grp = { name: string; subs: Sub[] };

// 채점 단위(unit) — lib/criteria-units.ScoringUnit에서 인쇄에 필요한 필드만
export type SheetUnit = {
  unitId: string;
  kind: "criterion" | "subitem";
  groupName: string;
  subitemId: string;
  subitemName: string;
  label: string;
  indicators: string[];
  maxScore: number;
};

export type SheetDocData = {
  sessionName: string;
  region: string | null;
  taskType: string | null;
  taskName: string | null;
  companyName: string;
  leadResearcher: string | null;
  evaluatorName: string;
  units: SheetUnit[]; // 이미 정렬된 상태
  valueOf: Map<string, number | null>; // unitId → 점수
  opinionText: string;
  // 제출 시 위원이 그린 핸드사인(PNG data URL) — '(인)' 자리에 도장처럼 표시
  signature: string | null;
  printedDate: string;
};

// 위원별 평가표(K-PASS 양식) 단일 문서. 전체 인쇄 시 여러 개를 페이지 나눔으로 이어 렌더.
export default function SheetDoc({ data, pageBreak = false }: { data: SheetDocData; pageBreak?: boolean }) {
  const { units, valueOf } = data;

  const groups: Grp[] = [];
  for (const u of units) {
    const gName = u.groupName || "미분류";
    let g = groups.find((x) => x.name === gName);
    if (!g) { g = { name: gName, subs: [] }; groups.push(g); }
    if (u.kind === "subitem") {
      const v = valueOf.get(u.unitId) ?? null;
      g.subs.push({
        key: u.subitemId,
        name: u.subitemName,
        lines: u.indicators.length ? u.indicators : [u.subitemName],
        maxScore: u.maxScore,
        filled: v != null,
        score: v ?? 0,
      });
    } else {
      let sg = g.subs.find((x) => x.key === u.subitemId);
      if (!sg) { sg = { key: u.subitemId, name: u.subitemName, lines: [], maxScore: 0, filled: true, score: 0 }; g.subs.push(sg); }
      const v = valueOf.get(u.unitId) ?? null;
      sg.lines.push(u.label);
      sg.maxScore += u.maxScore;
      sg.filled = sg.filled && v != null;
      sg.score += v ?? 0;
    }
  }

  const maxTotal = units.reduce((s, u) => s + u.maxScore, 0);
  const total = units.reduce((s, u) => s + (valueOf.get(u.unitId) ?? 0), 0);
  const filled = units.filter((u) => valueOf.get(u.unitId) != null).length;

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
            const groupRowSpan = g.subs.reduce((n, s) => n + Math.max(1, s.lines.length), 0) || 1;
            const gTotal = g.subs.reduce((n, s) => n + s.maxScore, 0);
            let groupPlaced = false;
            return g.subs.map((sg) => {
              const subRowSpan = Math.max(1, sg.lines.length);
              return sg.lines.map((line, cIdx) => {
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
                      <span>{line}</span>
                    </div>
                  </td>,
                );
                if (cIdx === 0) {
                  cells.push(
                    <td key="m" rowSpan={subRowSpan} className={`${td} text-center align-middle tabular-nums`}>
                      {fmt(sg.maxScore)}
                    </td>,
                    <td key="v" rowSpan={subRowSpan} className={`${td} text-center align-middle font-semibold tabular-nums`}>
                      {sg.filled && sg.lines.length > 0 ? fmt(sg.score) : ""}
                    </td>,
                  );
                }
                return <tr key={`${sg.key}-${cIdx}`}>{cells}</tr>;
              });
            });
          })}
          {units.length === 0 && (
            <tr>
              <td colSpan={5} className={`${td} py-8 text-center text-slate-400`}>평가 항목이 없습니다.</td>
            </tr>
          )}
          <tr className="font-bold">
            <td colSpan={3} className={`${td} text-center`}>합 계</td>
            <td className={`${td} text-center tabular-nums`}>{fmt(maxTotal)}</td>
            <td className={`${td} text-center tabular-nums`}>{filled === units.length && units.length > 0 ? fmt(total) : ""}</td>
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

      {/* 하단 — 날짜(좌) · 평가위원 서명(우). 제출 서명이 있으면 '(인)' 위에 도장처럼 겹쳐 표시 */}
      <div className="mt-6 flex items-end justify-between text-sm">
        <span>{data.printedDate}</span>
        <span>
          평가위원 : <span className="font-semibold">{data.evaluatorName}</span>
          <span className="relative ml-1 inline-block">
            (인)
            {data.signature && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.signature}
                alt="서명"
                className="pointer-events-none absolute -top-8 left-1/2 h-12 w-auto max-w-28 -translate-x-1/2"
              />
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
