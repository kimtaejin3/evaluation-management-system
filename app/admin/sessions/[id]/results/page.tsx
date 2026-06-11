import { prisma } from "@/lib/db";
import { computeFinalScores, rankSubjects, overallGrade } from "@/lib/scoring";
import { getSessionInsights } from "@/lib/progress";
import CompanyLogo from "@/components/CompanyLogo";
import PrintButton from "./PrintButton";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" }) : "미정";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.evaluationSession.findUnique({ where: { id } });
  const subjects = await prisma.subject.findMany({ where: { sessionId: id } });
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id } });
  const scores = await prisma.score.findMany({ where: { sessionId: id } });
  const assignments = await prisma.assignment.findMany({ where: { sessionId: id } });

  const finalScores = computeFinalScores(
    scores.map((s) => ({
      evaluatorId: s.evaluatorId,
      subjectId: s.subjectId,
      criterionId: s.criterionId,
      value: s.value,
    })),
    criteria.map((c) => ({ id: c.id, weight: c.weight })),
  );
  const ranked = rankSubjects(finalScores);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const orderedCriteria = [...criteria].sort((a, b) => a.order - b.order);
  const maxTotal = criteria.reduce((s, c) => s + c.maxScore * c.weight, 0);
  const insights = await getSessionInsights(id);
  const divergent = insights.rows.filter((r) => r.spread !== null && r.spread >= 10);
  // 대상×항목 위원 평균
  const critAvg = (subId: string, critId: string): number | null => {
    const vs = scores.filter((s) => s.subjectId === subId && s.criterionId === critId).map((s) => s.value);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  const printedAt = new Date().toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" });

  return (
    <div className="space-y-5">
      {/* 화면 전용 컨트롤 */}
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">위원 평균 가중 점수 기준 순위입니다.</p>
        <div className="flex gap-2">
          <a
            href={`/api/sessions/${id}/results.csv`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            CSV 다운로드
          </a>
          <PrintButton />
        </div>
      </div>

      {/* 인쇄 문서 머리글 */}
      <div className="hidden print:block">
        <div className="text-center">
          <div className="text-xs tracking-wide text-slate-500">사업 심사·평가 종합관리시스템</div>
          <h1 className="mt-1 text-2xl font-bold">심사 결과 총괄표</h1>
        </div>
        <table className="mt-5 w-full border border-black text-sm">
          <tbody>
            <tr>
              <th className="w-28 border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">회차명</th>
              <td className="border border-black px-3 py-1.5">{session?.name}</td>
              <th className="w-28 border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">평가 일시</th>
              <td className="border border-black px-3 py-1.5">{fmtDate(session?.eventDate ?? null)}</td>
            </tr>
            <tr>
              <th className="border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">장소</th>
              <td className="border border-black px-3 py-1.5">{session?.location ?? "—"}</td>
              <th className="border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">평가 대상</th>
              <td className="border border-black px-3 py-1.5">{subjects.length}개 · 위원 {assignments.length}명</td>
            </tr>
            <tr>
              <th className="border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">출력일</th>
              <td className="border border-black px-3 py-1.5" colSpan={3}>{printedAt}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 순위표 (화면 + 인쇄 공용) */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print:mt-4 print:overflow-visible print:rounded-none print:border-black">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 print:text-black">
            <tr className="border-b border-slate-100 print:border-black">
              <th className="px-5 py-3 font-medium print:border print:border-black">순위</th>
              <th className="px-5 py-3 font-medium print:border print:border-black">대상</th>
              {orderedCriteria.map((c) => (
                <th key={c.id} className="px-4 py-3 text-right font-medium print:border print:border-black">
                  {c.name}
                  <div className="text-xs font-normal text-slate-400 print:text-black">/{c.maxScore} · 가중 {c.weight}</div>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium print:border print:border-black">최종 점수<div className="text-xs font-normal text-slate-400 print:text-black">/{fmt(maxTotal)}</div></th>
              <th className="px-4 py-3 text-right font-medium print:border print:border-black">환산<div className="text-xs font-normal text-slate-400 print:text-black">/100</div></th>
              <th className="px-4 py-3 text-center font-medium print:border print:border-black">등급</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => {
              const norm = maxTotal > 0 ? (r.finalScore / maxTotal) * 100 : 0;
              const grade = overallGrade(r.finalScore, maxTotal);
              return (
                <tr key={r.subjectId} className="border-b border-slate-50 last:border-0 print:border-black">
                  <td className="px-5 py-3 print:border print:border-black">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 print:bg-transparent print:text-black">
                      {r.rank}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-800 print:border print:border-black">
                    <span className="inline-flex items-center gap-2">
                      <CompanyLogo name={subjectName.get(r.subjectId) ?? ''} className="h-6 w-6 print:hidden" />
                      {subjectName.get(r.subjectId)}
                    </span>
                  </td>
                  {orderedCriteria.map((c) => {
                    const a = critAvg(r.subjectId, c.id);
                    return (
                      <td key={c.id} className="px-4 py-3 text-right tabular-nums text-slate-600 print:border print:border-black">
                        {a === null ? "—" : a.toFixed(1)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right text-lg font-bold text-slate-900 print:border print:border-black print:text-base">
                    {r.finalScore.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 print:border print:border-black">{norm.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center print:border print:border-black">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-[var(--gov-navy)] px-1.5 text-sm font-bold text-white print:bg-transparent print:text-black">{grade}</span>
                  </td>
                </tr>
              );
            })}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={orderedCriteria.length + 5} className="px-5 py-12 text-center text-slate-400">집계할 점수가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 합산 공식 + 위원 간 편차 정보 (화면 전용) */}
      <div className="grid gap-4 print:hidden lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          <div className="mb-1.5 font-semibold text-slate-600">합산 공식</div>
          <ul className="space-y-1">
            <li>· 위원 점수 = Σ(항목 점수 × 가중치)</li>
            <li>· 최종 점수 = 배정 위원 점수의 평균 (만점 {fmt(maxTotal)}점)</li>
            <li>· 환산 = 최종 ÷ {fmt(maxTotal)} × 100</li>
            <li>· 등급 = 환산 90↑ S · 80↑ A · 70↑ B · 60↑ C · 그 외 D</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          <div className="mb-1.5 font-semibold text-slate-600">위원 간 편차 정보</div>
          {divergent.length === 0 ? (
            <p className="text-slate-400">편차가 큰(±10 이상) 대상이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {divergent.map((r) => (
                <li key={r.subjectId} className="flex items-center justify-between">
                  <span className="text-slate-600">{r.name}</span>
                  <span className="font-medium text-amber-700">편차 ±{fmt(r.spread!)} · 재검토 권장</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-slate-400">완료 위원 2명 이상인 대상 기준 · 최고-최저 차이</p>
        </div>
      </div>

      {/* 인쇄 전용 확인란 */}
      <div className="mt-16 hidden grid-cols-2 gap-10 print:grid">
        <div className="text-sm">
          <div className="mb-10 text-slate-500">작성자</div>
          <div className="border-t border-black pt-1 text-center text-slate-500">(서명 또는 인)</div>
        </div>
        <div className="text-sm">
          <div className="mb-10 text-slate-500">확인자</div>
          <div className="border-t border-black pt-1 text-center text-slate-500">(서명 또는 인)</div>
        </div>
      </div>
    </div>
  );
}
