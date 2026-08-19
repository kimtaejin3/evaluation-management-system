import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { computeFinalScores, rankSubjects, computeWeightedScore } from "@/lib/scoring";
import { scoringUnitsForScope } from "@/lib/criteria-scope";
import { scoreUnitId } from "@/lib/criteria-units";
import ResultsReviewCell from "@/components/ResultsReviewCell";
import ExcelExportButton from "@/components/ExcelExportButton";
import OverallRankingTable from "@/components/OverallRankingTable";
import { SkeletonTable } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 사업 집계 결과 — ① 전체 순위(전 분과 통합, 분과 필터+페이지네이션) ② 분과별 검토 현황
// ③ 분과별 집계·검토 현황. 점수는 승인(APPROVED)된 (위원×대상) 제출만 집계한다.
export default async function ProjectResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 제목·설명은 정적이므로 Suspense 밖에서 즉시 렌더 — 로딩 중에도 보인다.
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-bold">집계 결과</h1>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/results`} />
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={6} />}>
        <Content id={id} />
      </Suspense>
      <p className="text-left text-xs text-slate-400">
        전 분과 통합 1위·전체 순위와 분과별 검토 현황입니다.
      </p>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  const { user } = await assertProjectAccess(id);
  const isMaster = user.role === "MASTER";
  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      chairId: true,
      submittedForReviewAt: true,
      secretary: { select: { name: true } },
    },
  });

  // 분과 집계 결과와 동일 계산: 승인(APPROVED)된 (위원×대상) 제출 점수로
  // computeFinalScores(항목별 위원 평균 합산) 후 rankSubjects.
  const sessionIds = sessions.map((s) => s.id);
  const [units, allScores, approvedSubs, subjects, assignments, opinions] = await Promise.all([
    scoringUnitsForScope({ projectId: id }),
    prisma.score.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, evaluatorId: true, subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.submission.findMany({
      where: { sessionId: { in: sessionIds }, status: "APPROVED" },
      select: { sessionId: true, evaluatorId: true, subjectId: true },
    }),
    prisma.subject.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sessionId: true },
    }),
    prisma.assignment.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, userId: true, user: { select: { name: true } } },
    }),
    prisma.opinion.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { evaluatorId: true, subjectId: true, text: true },
    }),
  ]);
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`));
  const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }));

  // 분과별 최종 점수(대상별) — subjectId는 전역 유일이므로 flat 맵으로 관리
  const finalScoreOf = new Map<string, number>();
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  for (const s of sessions) {
    const rows = allScores
      .filter((sc) => sc.sessionId === s.id && approved.has(`${sc.evaluatorId}:${sc.subjectId}`))
      .map((sc) => ({ evaluatorId: sc.evaluatorId, subjectId: sc.subjectId, criterionId: scoreUnitId(sc), value: sc.value }));
    const ranked = rankSubjects(computeFinalScores(rows, weights));
    for (const r of ranked) finalScoreOf.set(r.subjectId, r.finalScore);
  }

  // 전 분과 통합 순위 — 분과 구분 없이 전체 대상을 점수순으로(동점 공동 순위).
  // 1위(공동 1위 포함)는 별도 테이블로 강조한다.
  const overallRanked = rankSubjects(finalScoreOf);
  const unscored = subjects.filter((sub) => !finalScoreOf.has(sub.id));
  const sessionOfSubject = new Map(subjects.map((sub) => [sub.id, sub.sessionId]));
  const sessionNameOf = new Map(sessions.map((s) => [s.id, s.name]));

  // 분과별 평가 대상 / 위원(위원장 우선) / (위원×대상) 점수·종합의견 — '평가의견 보기' 모달용
  const subjectsOf = new Map<string, { id: string; name: string }[]>();
  for (const sub of subjects) {
    if (!subjectsOf.has(sub.sessionId)) subjectsOf.set(sub.sessionId, []);
    subjectsOf.get(sub.sessionId)!.push({ id: sub.id, name: sub.name });
  }
  const chairOf = new Map(sessions.map((s) => [s.id, s.chairId]));
  const evaluatorsOf = new Map<string, { id: string; name: string; isChair: boolean }[]>();
  for (const a of assignments) {
    if (!evaluatorsOf.has(a.sessionId)) evaluatorsOf.set(a.sessionId, []);
    evaluatorsOf.get(a.sessionId)!.push({ id: a.userId, name: a.user.name, isChair: a.userId === chairOf.get(a.sessionId) });
  }
  for (const evs of evaluatorsOf.values()) evs.sort((a, b) => (b.isChair ? 1 : 0) - (a.isChair ? 1 : 0));
  const opinionText = new Map<string, string>();
  for (const o of opinions) if (o.text.trim()) opinionText.set(`${o.evaluatorId}:${o.subjectId}`, o.text);
  const scoreRowsOf = new Map<string, { criterionId: string; value: number }[]>();
  for (const sc of allScores) {
    const k = `${sc.evaluatorId}:${sc.subjectId}`;
    if (!scoreRowsOf.has(k)) scoreRowsOf.set(k, []);
    scoreRowsOf.get(k)!.push({ criterionId: scoreUnitId(sc), value: sc.value });
  }
  // 모달 내용 = 이 대상에 대해 승인된 제출의 위원별 점수·종합의견(집계에 실제 반영된 것만)
  const approvedEvaluatorsFor = (sessionId: string, subjectId: string) =>
    (evaluatorsOf.get(sessionId) ?? []).flatMap((ev) => {
      if (!approved.has(`${ev.id}:${subjectId}`)) return [];
      const rows = scoreRowsOf.get(`${ev.id}:${subjectId}`) ?? [];
      if (rows.length === 0) return [];
      return [
        {
          name: ev.name,
          isChair: ev.isChair,
          score: computeWeightedScore(rows, weights),
          opinion: opinionText.get(`${ev.id}:${subjectId}`) ?? null,
        },
      ];
    });

  // 위원장 종합의견 — 위원장 본인의 채점 제출/승인 여부와 무관하게 작성된다.
  // (점수는 승인 제출만 반영하지만, 종합의견은 작성 즉시 보여야 한다)
  const chairOpinionFor = (sessionId: string, subjectId: string) => {
    const chairId = chairOf.get(sessionId);
    if (!chairId) return null;
    const text = opinionText.get(`${chairId}:${subjectId}`);
    if (!text) return null;
    const name = (evaluatorsOf.get(sessionId) ?? []).find((ev) => ev.id === chairId)?.name ?? "";
    return { name, text };
  };

  // 전체 순위 표(클라이언트) 행 데이터 — 미집계 대상은 순번을 이어받아 맨 아래
  const secretaryOf = new Map(sessions.map((s) => [s.id, s.secretary?.name ?? null]));
  const submittedOf = new Map(sessions.map((s) => [s.id, !!s.submittedForReviewAt]));
  const overallRows = [
    ...overallRanked.map((r) => {
      const sessId = sessionOfSubject.get(r.subjectId)!;
      return {
        id: r.subjectId,
        rank: r.rank as number,
        name: subjectName.get(r.subjectId) ?? "",
        sessionId: sessId,
        sessionName: sessionNameOf.get(sessId) ?? "",
        score: r.finalScore as number | null,
        isTop: r.rank === 1,
        secretaryName: secretaryOf.get(sessId) ?? null,
        submitted: submittedOf.get(sessId) ?? false,
        chairOpinion: chairOpinionFor(sessId, r.subjectId),
        evaluators: approvedEvaluatorsFor(sessId, r.subjectId),
      };
    }),
    ...unscored.map((sub, i) => ({
      id: sub.id,
      rank: overallRanked.length + i + 1,
      name: sub.name,
      sessionId: sub.sessionId,
      sessionName: sessionNameOf.get(sub.sessionId) ?? "",
      score: null as number | null,
      isTop: false,
      secretaryName: secretaryOf.get(sub.sessionId) ?? null,
      submitted: submittedOf.get(sub.sessionId) ?? false,
      chairOpinion: chairOpinionFor(sub.sessionId, sub.id),
      evaluators: approvedEvaluatorsFor(sub.sessionId, sub.id),
    })),
  ];

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
        아직 분과가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ① 전체 순위 — 전 분과 통합 점수순. 분과 필터 + 5개씩 페이지네이션. 1위 하이라이트, 미집계는 맨 아래 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          전체 순위 <span className="ml-0.5 text-xs font-normal text-slate-400">전 분과 통합 · {overallRows.length}개 대상</span>
        </h2>
        <OverallRankingTable rows={overallRows} sessions={sessions.map((s) => ({ id: s.id, name: s.name }))} />
      </div>

      {/* ② 분과별 집계·검토 현황(기존 테이블) */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">분과별 검토 현황</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">담당자</th>
                <th className="px-5 py-3 font-medium">담당자 제출</th>
                <th className="px-5 py-3 text-center font-medium">검토 상태</th>
                <th className="px-5 py-3 font-medium">분과 집계 결과</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const submitted = !!s.submittedForReviewAt;
                const closed = s.status === "CLOSED";
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      {/* 이동은 '자세히 보기'로 — 분과명은 일반 텍스트 */}
                      <span className="font-medium text-slate-800">{s.name}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.secretary?.name ?? <span className="text-xs text-rose-600">미배정</span>}
                    </td>
                    <td className="px-5 py-3">
                      {/* 담당자 제출 — 텍스트만(제출=검정, 미제출=빨강), 다른 테이블과 통일 */}
                      {submitted ? (
                        <span className="text-xs whitespace-nowrap text-slate-900">제출</span>
                      ) : (
                        <span className="text-xs whitespace-nowrap text-rose-600">미제출</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <ResultsReviewCell sessionId={s.id} submitted={submitted} closed={closed} isMaster={isMaster} />
                    </td>
                    <td className="px-5 py-3">
                      {/* 분과 상세의 집계 결과 페이지로 이동 */}
                      <Link
                        href={`/admin/sessions/${s.id}/results`}
                        className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                      >
                        분과 집계 결과
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
