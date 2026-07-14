import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { computeFinalScores, rankSubjects } from "@/lib/scoring";
import { getSessionInsights } from "@/lib/progress";
import { TOTAL_SCORE } from "@/lib/criteria";
import ResultsView from "./ResultsView";
import CompleteReviewButton from "./CompleteReviewButton";
import SubmitReviewButton from "./SubmitReviewButton";
import ExcelExportButton from "@/components/ExcelExportButton";
import { requireAdminUser } from "@/lib/authz";
import { SkeletonCard, SkeletonTable } from "@/components/Skeletons";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" }) : "미정";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <SkeletonTable rows={6} cols={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      }
    >
      <ResultsContent id={id} />
    </Suspense>
  );
}

async function ResultsContent({ id }: { id: string }) {
  const me = await requireAdminUser();
  const [session, subjects, criteria, scores, assignments, insights, approvedSubs] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.subject.findMany({ where: { sessionId: id } }),
    prisma.criterion.findMany({
      where: { sessionId: id },
      include: { subitem: { include: { group: true } } },
    }),
    prisma.score.findMany({ where: { sessionId: id } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: { select: { id: true, name: true } } } }),
    getSessionInsights(id),
    prisma.submission.findMany({ where: { sessionId: id, status: "APPROVED" }, select: { evaluatorId: true, subjectId: true } }),
  ]);

  // 집계는 승인(APPROVED)된 (위원, 대상)의 점수만 사용
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`));
  const approvedScores = scores.filter((s) => approved.has(`${s.evaluatorId}:${s.subjectId}`));

  const finalScores = computeFinalScores(
    approvedScores.map((s) => ({
      evaluatorId: s.evaluatorId,
      subjectId: s.subjectId,
      criterionId: s.criterionId,
      value: s.value,
    })),
    criteria.map((c) => ({ id: c.id, weight: c.weight })),
  );
  const ranked = rankSubjects(finalScores);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const orderedCriteria = [...criteria].sort((a, b) => {
    const ga = a.subitem?.group.order ?? 0;
    const gb = b.subitem?.group.order ?? 0;
    if (ga !== gb) return ga - gb;
    const sa = a.subitem?.order ?? 0;
    const sb = b.subitem?.order ?? 0;
    if (sa !== sb) return sa - sb;
    return a.order - b.order;
  });
  // 환산·등급 기준 만점 = 분과 설정값(기본 100). 가점이 있으면 100 초과 점수 가능.
  const maxTotal = session?.maxScore ?? TOTAL_SCORE;
  const divergent = insights.rows.filter((r) => r.spread !== null && r.spread >= 10);
  // (위원:대상:항목) → 점수 (RankingTable에 전달, 클라이언트에서 평균·위원별 계산)
  const scoreVal = new Map<string, number>();
  for (const s of approvedScores) scoreVal.set(`${s.evaluatorId}:${s.subjectId}:${s.criterionId}`, s.value);
  const printedAt = new Date().toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" });
  const chair = session?.chairId ? await prisma.user.findUnique({ where: { id: session.chairId }, select: { name: true } }) : null;

  // 열=대상(순위순), 행=평가 항목. 순위에 없는(점수 없는) 대상은 뒤에 붙임.
  const rankInfo = new Map(ranked.map((r) => [r.subjectId, r]));
  const orderedSubjects = [
    ...ranked.map((r) => ({ id: r.subjectId, name: subjectName.get(r.subjectId) ?? "", finalScore: r.finalScore, rank: r.rank as number | null })),
    ...subjects
      .filter((s) => !rankInfo.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, finalScore: 0, rank: null as number | null })),
  ];
  // 항목을 평가항목(그룹)별로 그룹핑 — 첫 행에 rowSpan
  const NO_GROUP = "미분류";
  const sectionGroups: { section: string; items: typeof orderedCriteria }[] = [];
  for (const c of orderedCriteria) {
    const key = c.subitem?.group.name || NO_GROUP;
    const last = sectionGroups[sectionGroups.length - 1];
    if (last && last.section === key) last.items.push(c);
    else sectionGroups.push({ section: key, items: [c] });
  }
  // 항목 번호 체계: 평가항목 1,2,3… / 세부항목 1-1,1-2…
  const itemCode = new Map<string, string>();
  sectionGroups.forEach((g, gi) => {
    g.items.forEach((c, ci) => itemCode.set(c.id, `${gi + 1}-${ci + 1}`));
  });
  // 선정(1위) 대상 — 동점이면 복수
  const winners = orderedSubjects.filter((s) => s.rank === 1);

  return (
    <div className="space-y-5">
      {/* 화면 전용 컨트롤 — 엑셀 내보내기(역할·상태 무관 고정) */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">위원 평균 점수 기준 선정 결과입니다.</p>
        <ExcelExportButton href={`/api/sessions/${id}/export/results`} />
      </div>

      {/* 인쇄 문서 머리글 */}
      <div className="hidden print:block">
        <div className="text-center">
          <div className="text-xs tracking-wide text-slate-500">사업 심사·평가 종합관리시스템</div>
          <h1 className="mt-1 text-2xl font-bold">분과 결과 총괄표</h1>
        </div>
        <table className="mt-5 w-full border border-black text-sm">
          <tbody>
            <tr>
              <th className="w-28 border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">분과명</th>
              <td className="border border-black px-3 py-1.5">{session?.name}</td>
              <th className="w-28 border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">평가 기간</th>
              <td className="border border-black px-3 py-1.5">
                {session?.startDate || session?.endDate
                  ? `${fmtDate(session?.startDate ?? null)} ~ ${fmtDate(session?.endDate ?? null)}`
                  : "—"}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">평가 대상</th>
              <td className="border border-black px-3 py-1.5" colSpan={3}>{subjects.length}개 · 위원 {assignments.length}명</td>
            </tr>
            <tr>
              <th className="border border-black bg-slate-100 px-3 py-1.5 text-left font-medium">출력일</th>
              <td className="border border-black px-3 py-1.5" colSpan={3}>{printedAt}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {orderedCriteria.length === 0 || orderedSubjects.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-slate-400 print:border-black">
          집계할 항목·대상이 없습니다.
        </div>
      ) : (
        <ResultsView
          sessionId={id}
          winners={winners.map((w) => ({ id: w.id, name: w.name, finalScore: w.finalScore }))}
          subjects={orderedSubjects}
          criteria={orderedCriteria.map((c) => ({ id: c.id, code: itemCode.get(c.id) ?? "", name: c.name, weight: c.weight }))}
          evaluators={assignments.map((a) => ({ id: a.userId, name: a.user.name }))}
          scores={Object.fromEntries(scoreVal)}
          maxTotal={maxTotal}
        />
      )}

      {/* 위원장 총괄평가 */}
      {session?.chairSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 print:border-black">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">위원장 총괄평가</span>
            {chair && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 print:bg-transparent print:text-black">{chair.name} 위원장</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{session.chairSummary}</p>
        </div>
      )}

      {/* 합산 공식 + 위원 간 편차 정보 (화면 전용) */}
      <div className="grid gap-4 print:hidden lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          <div className="mb-1.5 font-semibold text-slate-600">합산 공식</div>
          <ul className="space-y-1">
            <li>· 위원 점수 = Σ(항목 점수) · 총배점 100점</li>
            <li>· 최종 점수 = 배정 위원 점수의 평균 (만점 {fmt(maxTotal)}점)</li>
            <li>· 등급 = 최종 90↑ S · 80↑ A · 70↑ B · 60↑ C · 그 외 D</li>
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

      {/* 분과 확정 (화면 전용, 최하단) — 간사: 제출 완료 / 관리자: 검토 완료 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 print:hidden">
        <div>
          <div className="text-sm font-semibold text-slate-700">
            {me.role === "MASTER" ? "분과 검토 완료" : "분과 제출 완료"}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {me.role === "MASTER"
              ? "간사가 제출 완료한 분과를 검토하면 ‘완료’ 상태가 되고 점수가 잠깁니다."
              : "집계 결과를 확인한 뒤 제출 완료하면 관리자가 검토합니다."}
          </p>
        </div>
        {me.role === "MASTER" ? (
          <CompleteReviewButton
            sessionId={id}
            closed={session?.status === "CLOSED"}
            submitted={session?.submittedForReviewAt != null}
          />
        ) : (
          <SubmitReviewButton
            sessionId={id}
            submitted={session?.submittedForReviewAt != null}
            closed={session?.status === "CLOSED"}
          />
        )}
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
