import { prisma } from "@/lib/db";
import { computeFinalScores, rankSubjects } from "@/lib/scoring";
import PrintButton from "./PrintButton";

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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white print:mt-4 print:rounded-none print:border-black">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 print:text-black">
            <tr className="border-b border-slate-100 print:border-black">
              <th className="px-5 py-3 font-medium print:border print:border-black">순위</th>
              <th className="px-5 py-3 font-medium print:border print:border-black">대상</th>
              <th className="px-5 py-3 text-right font-medium print:border print:border-black">최종 점수</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.subjectId} className="border-b border-slate-50 last:border-0 print:border-black">
                <td className="px-5 py-3 print:border print:border-black">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 print:bg-transparent print:text-black">
                    {r.rank}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-slate-800 print:border print:border-black">
                  {subjectName.get(r.subjectId)}
                </td>
                <td className="px-5 py-3 text-right text-lg font-bold text-slate-900 print:border print:border-black print:text-base">
                  {r.finalScore.toFixed(2)}
                </td>
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center text-slate-400">집계할 점수가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
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
