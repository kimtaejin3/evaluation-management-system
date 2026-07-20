import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { computeFinalScores, rankSubjects, computeWeightedScore } from "@/lib/scoring";
import { scoringUnitsForScope } from "@/lib/criteria-scope";
import { scoreUnitId } from "@/lib/criteria-units";
import ResultsReviewCell from "@/components/ResultsReviewCell";
import ExcelExportButton from "@/components/ExcelExportButton";
import SubjectScoresDetail from "@/components/SubjectScoresDetail";
import { SkeletonTable } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 과제 집계 결과 — ① 전체 1위(전 분과 통합) ② 분과별 평가 대상 점수(기업명/점수/평가의견)
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
          <Link href={`/admin/projects/${id}`} className="text-sm text-slate-400 hover:text-slate-600">
            ← 분과 목록
          </Link>
          <h1 className="mt-1 text-2xl font-bold">집계 결과</h1>
          <p className="mt-1 text-sm text-slate-500">
            전 분과 통합 1위·전체 순위와 분과별 대상 점수·검토 현황입니다.
          </p>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/results`} />
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={6} />}>
        <Content id={id} />
      </Suspense>
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
  const topOfSession = new Map<string, { name: string; score: number }>();
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  for (const s of sessions) {
    const rows = allScores
      .filter((sc) => sc.sessionId === s.id && approved.has(`${sc.evaluatorId}:${sc.subjectId}`))
      .map((sc) => ({ evaluatorId: sc.evaluatorId, subjectId: sc.subjectId, criterionId: scoreUnitId(sc), value: sc.value }));
    const ranked = rankSubjects(computeFinalScores(rows, weights));
    for (const r of ranked) finalScoreOf.set(r.subjectId, r.finalScore);
    const top = ranked.find((r) => r.rank === 1);
    if (top) topOfSession.set(s.id, { name: subjectName.get(top.subjectId) ?? "", score: top.finalScore });
  }

  // 전 분과 통합 순위 — 분과 구분 없이 전체 대상을 점수순으로(동점 공동 순위).
  // 1위(공동 1위 포함)는 별도 테이블로 강조한다.
  const overallRanked = rankSubjects(finalScoreOf);
  const winners = overallRanked.filter((r) => r.rank === 1);
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

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
        아직 분과가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ① 전 분과 통합 1위 — 분과 구분 없이 최고 점수 기업(동점이면 공동 1위 모두) */}
      <div className="space-y-2">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            전 분과 통합 <span className="text-indigo-600">1위</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">모든 분과의 평가 대상을 통틀어 가장 높은 점수를 받은 기업입니다.</p>
        </div>
        <div className="overflow-hidden rounded-xl border-2 border-indigo-300 bg-white">
          {winners.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">아직 집계된(승인된) 점수가 없습니다.</p>
          ) : (
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">기업명</th>
                  <th className="px-5 py-2.5 font-medium">분과</th>
                  <th className="w-32 px-5 py-2.5 text-right font-medium">점수</th>
                  <th className="w-36 px-5 py-2.5 font-medium">자세히 보기</th>
                </tr>
              </thead>
              <tbody>
                {winners.map((r) => {
                  const sessId = sessionOfSubject.get(r.subjectId)!;
                  return (
                    <tr key={r.subjectId} className="bg-indigo-50/40">
                      <td className="px-5 py-3">
                        <span className="text-base font-bold text-slate-900">{subjectName.get(r.subjectId)}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{sessionNameOf.get(sessId)}</td>
                      <td className="px-5 py-3 text-right text-base font-bold tabular-nums text-indigo-700">
                        {r.finalScore.toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <SubjectScoresDetail
                          subjectName={subjectName.get(r.subjectId) ?? ""}
                          buttonLabel="자세히 보기"
                          note="집계에 반영된(승인 제출) 위원별 점수와 종합의견입니다."
                          emptyMessage="집계에 반영된 위원 점수가 없습니다."
                          evaluators={approvedEvaluatorsFor(sessId, r.subjectId)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ② 전체 순위 — 분과 구분 없이 전 대상 점수순(고정 높이 + 스크롤), 미집계 대상은 맨 아래 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          전체 순위 <span className="ml-0.5 text-xs font-normal text-slate-400">전 분과 통합 · {overallRanked.length + unscored.length}개 대상</span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {overallRanked.length + unscored.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">등록된 평가 대상이 없습니다.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="table-grid w-full text-sm [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10">
                <thead className="text-left text-slate-500">
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="w-20 px-5 py-2.5 font-medium">순위</th>
                    <th className="px-5 py-2.5 font-medium">기업명</th>
                    <th className="px-5 py-2.5 font-medium">분과</th>
                    <th className="w-32 px-5 py-2.5 text-right font-medium">점수</th>
                    <th className="w-36 px-5 py-2.5 font-medium">자세히 보기</th>
                  </tr>
                </thead>
                <tbody>
                  {overallRanked.map((r) => {
                    const sessId = sessionOfSubject.get(r.subjectId)!;
                    return (
                      <tr key={r.subjectId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 font-medium tabular-nums text-slate-700">{r.rank}</td>
                        <td className="px-5 py-2.5 font-medium text-slate-800">{subjectName.get(r.subjectId)}</td>
                        <td className="px-5 py-2.5 text-slate-600">{sessionNameOf.get(sessId)}</td>
                        <td className="px-5 py-2.5 text-right font-medium tabular-nums text-slate-800">
                          {r.finalScore.toFixed(2)}
                        </td>
                        <td className="px-5 py-2.5">
                          <SubjectScoresDetail
                            subjectName={subjectName.get(r.subjectId) ?? ""}
                            buttonLabel="자세히 보기"
                            note="집계에 반영된(승인 제출) 위원별 점수와 종합의견입니다."
                            emptyMessage="집계에 반영된 위원 점수가 없습니다."
                            evaluators={approvedEvaluatorsFor(sessId, r.subjectId)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {unscored.map((sub) => (
                    <tr key={sub.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2.5 text-slate-300">—</td>
                      <td className="px-5 py-2.5 text-slate-500">{sub.name}</td>
                      <td className="px-5 py-2.5 text-slate-500">{sessionNameOf.get(sub.sessionId)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-300">—</td>
                      <td className="px-5 py-2.5">
                        <SubjectScoresDetail
                          subjectName={sub.name}
                          buttonLabel="자세히 보기"
                          note="집계에 반영된(승인 제출) 위원별 점수와 종합의견입니다."
                          emptyMessage="집계에 반영된 위원 점수가 없습니다."
                          evaluators={approvedEvaluatorsFor(sub.sessionId, sub.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ② 분과별 평가 대상 점수 — 기업명 / 점수 / 평가의견 보기 */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">분과별 평가 대상 점수</h2>
        {sessions.map((s) => {
          const subs = [...(subjectsOf.get(s.id) ?? [])].sort((a, b) => {
            const ka = finalScoreOf.get(a.id) ?? -Infinity;
            const kb = finalScoreOf.get(b.id) ?? -Infinity;
            return kb - ka || a.name.localeCompare(b.name, "ko");
          });
          return (
            <div key={s.id} className="space-y-2">
              <h3 className="text-sm font-medium text-slate-600">
                {s.name} <span className="ml-0.5 text-xs text-slate-400">{subs.length}개 대상</span>
              </h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {subs.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-slate-400">등록된 평가 대상이 없습니다.</p>
                ) : (
                  <table className="table-grid w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="px-5 py-2.5 font-medium">기업명</th>
                        <th className="w-32 px-5 py-2.5 text-right font-medium">점수</th>
                        <th className="w-36 px-5 py-2.5 font-medium">평가의견 보기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map((sub) => {
                        const score = finalScoreOf.get(sub.id);
                        return (
                          <tr key={sub.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                            <td className="px-5 py-2.5 font-medium text-slate-800">{sub.name}</td>
                            <td className="px-5 py-2.5 text-right font-medium tabular-nums text-slate-800">
                              {score !== undefined ? score.toFixed(2) : <span className="font-normal text-slate-300">—</span>}
                            </td>
                            <td className="px-5 py-2.5">
                              <SubjectScoresDetail
                                subjectName={sub.name}
                                buttonLabel="보기"
                                note="집계에 반영된(승인 제출) 위원별 점수와 종합의견입니다."
                                emptyMessage="집계에 반영된 위원 점수가 없습니다."
                                evaluators={approvedEvaluatorsFor(s.id, sub.id)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ③ 분과별 집계·검토 현황(기존 테이블) */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">분과별 집계·검토 현황</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">담당 간사</th>
                <th className="px-5 py-3 font-medium">간사 제출</th>
                <th className="px-5 py-3 font-medium">선정 결과</th>
                <th className="px-5 py-3 font-medium">자세히 보기</th>
                <th className="px-5 py-3 font-medium">검토 상태</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const top = topOfSession.get(s.id);
                const submitted = !!s.submittedForReviewAt;
                const closed = s.status === "CLOSED";
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/sessions/${s.id}/results`}
                        className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.secretary?.name ?? <span className="text-xs text-slate-400">미배정</span>}
                    </td>
                    <td className="px-5 py-3">
                      {submitted ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-800 ring-1 ring-inset ring-emerald-300">
                          제출
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800 ring-1 ring-inset ring-amber-300">
                          미제출
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {top ? <span>{top.name}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {/* 분과 상세의 집계 결과 페이지로 이동 */}
                      <Link
                        href={`/admin/sessions/${s.id}/results`}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
                      >
                        자세히 보기
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <ResultsReviewCell sessionId={s.id} submitted={submitted} closed={closed} isMaster={isMaster} />
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
