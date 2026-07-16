import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { computeFinalScores, rankSubjects } from "@/lib/scoring";
import ResultsReviewCell from "@/components/ResultsReviewCell";
import ExcelExportButton from "@/components/ExcelExportButton";
import { SkeletonTable } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 과제 집계 결과 — 분과별 집계·검토 현황을 테이블 뷰로 한눈에.
// 순위 총괄표·인쇄 등 상세는 분과의 집계 결과 페이지에서 한다.
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
            분과별 집계·검토 현황입니다. 순위 총괄표는 분과 페이지에서 확인합니다.
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
      submittedForReviewAt: true,
      secretary: { select: { name: true } },
    },
  });

  // 분과별 1위 — 분과 집계 결과와 동일 계산: 승인(APPROVED)된 (위원×대상) 제출 점수로
  // computeFinalScores(항목별 위원 평균 합산) 후 rankSubjects.
  const sessionIds = sessions.map((s) => s.id);
  const [criteria, allScores, approvedSubs, subjects] = await Promise.all([
    prisma.criterion.findMany({ where: { projectId: id }, select: { id: true, weight: true } }),
    prisma.score.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, evaluatorId: true, subjectId: true, criterionId: true, value: true },
    }),
    prisma.submission.findMany({
      where: { sessionId: { in: sessionIds }, status: "APPROVED" },
      select: { sessionId: true, evaluatorId: true, subjectId: true },
    }),
    prisma.subject.findMany({ where: { sessionId: { in: sessionIds } }, select: { id: true, name: true } }),
  ]);
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const topOfSession = new Map<string, { name: string; score: number }>();
  for (const s of sessions) {
    const rows = allScores.filter((sc) => sc.sessionId === s.id && approved.has(`${sc.evaluatorId}:${sc.subjectId}`));
    const ranked = rankSubjects(computeFinalScores(rows, criteria));
    const top = ranked.find((r) => r.rank === 1);
    if (top) topOfSession.set(s.id, { name: subjectName.get(top.subjectId) ?? "", score: top.finalScore });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {sessions.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
      ) : (
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
                    {top ? (
                      <span>{top.name}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
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
      )}
    </div>
  );
}
