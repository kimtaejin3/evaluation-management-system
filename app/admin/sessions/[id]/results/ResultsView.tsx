import RankingTable, { type RankSubject, type RankCriterion, type RankEvaluator } from "@/components/RankingTable";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// 선정 결과(1위) 요약 + 순위표를 페이지에 상시 노출. 인쇄 버튼은 상단 툴바(ResultsPrintButton)로 이동.
export default function ResultsView({
  winners,
  subjects,
  criteria,
  evaluators,
  scores,
  maxTotal,
}: {
  winners: { id: string; name: string; finalScore: number }[];
  subjects: RankSubject[];
  criteria: RankCriterion[];
  evaluators: RankEvaluator[];
  scores: Record<string, number>;
  maxTotal: number;
}) {
  return (
    <>
      {/* 선정 결과 카드 */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 print:border-black">
        <div className="text-sm font-semibold text-slate-500">선정 결과 (1위)</div>
        {winners.length === 0 ? (
          <p className="mt-2 text-slate-400">아직 선정된 대상이 없습니다.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {winners.map((w) => (
              <div key={w.id} className="flex flex-wrap items-baseline gap-2.5">
                <span className="rounded-md bg-[var(--gov-navy)] px-2 py-0.5 text-xs font-bold text-white print:bg-transparent print:text-black">
                  선정
                </span>
                <span className="text-2xl font-bold text-slate-900">{w.name}</span>
                <span className="text-sm text-slate-500">
                  최종 {fmt(w.finalScore)} / {fmt(maxTotal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 순위표 */}
      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">순위</h3>
        <RankingTable subjects={subjects} criteria={criteria} evaluators={evaluators} scores={scores} maxTotal={maxTotal} />
      </section>
    </>
  );
}
