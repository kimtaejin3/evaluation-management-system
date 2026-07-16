import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { getSessionInsights } from "@/lib/progress";
import ResultsReviewCell from "@/components/ResultsReviewCell";
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
      <div>
        <Link href={`/admin/projects/${id}`} className="text-sm text-slate-400 hover:text-slate-600">
          ← 분과 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold">집계 결과</h1>
        <p className="mt-1 text-sm text-slate-500">
          분과별 집계·검토 현황입니다. 순위 총괄표는 분과 페이지에서 확인합니다.
        </p>
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

  // 분과별 잠정 1위(완료 위원 평균 기준, 승인분만 반영)
  const insights = await Promise.all(sessions.map((s) => getSessionInsights(s.id)));

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
              <th className="px-5 py-3 font-medium">1위(잠정)</th>
              <th className="px-5 py-3 font-medium">자세히 보기</th>
              <th className="px-5 py-3 font-medium">검토 상태</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => {
              const top = insights[i].rows.find((r) => r.rank === 1);
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
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-indigo-700 ring-1 ring-inset ring-indigo-200">
                        제출
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-slate-500 ring-1 ring-inset ring-slate-200">
                        미제출
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {top && top.avg !== null ? (
                      <span>
                        {top.name}{" "}
                        <span className="tabular-nums text-slate-500">· {top.avg.toFixed(2)}점</span>
                      </span>
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
