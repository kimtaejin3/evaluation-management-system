import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import ReviewStatusBadge, { ApprovalBadge } from "@/components/ReviewStatusBadge";
import ReviewDecisionButtons from "@/components/ReviewDecisionButtons";
import { SkeletonTable } from "@/components/Skeletons";

// 과제 평가의견서 — 분과별 의견서 작성 현황을 테이블 뷰로 한눈에.
// 의견서 본문 열람·승인/반려는 분과의 평가 의견서 페이지에서 한다.
export default async function ProjectOpinionsPage({
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
        <h1 className="mt-1 text-2xl font-bold">평가의견서</h1>
        <p className="mt-1 text-sm text-slate-500">
          분과별 의견서 작성 현황입니다. 본문 열람은 분과 페이지에서 합니다.
        </p>
      </div>
      <Suspense fallback={<SkeletonTable rows={5} cols={6} />}>
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
      opinionStatus: true,
      secretary: { select: { name: true } },
      _count: { select: { subjects: true } },
    },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">담당 간사</th>
                <th className="px-5 py-3 font-medium">간사 검토</th>
                <th className="px-5 py-3 font-medium">평가 대상 수</th>
                <th className="px-5 py-3 font-medium">자세히 보기</th>
                <th className="px-5 py-3 font-medium">승인 상태</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/sessions/${s.id}/opinions`}
                        className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.secretary?.name ?? <span className="text-xs text-slate-400">미배정</span>}
                    </td>
                    <td className="px-5 py-3">
                      {/* 간사 검토 상태 — 의견서는 간사가 '검토'하는 도메인 */}
                      <ReviewStatusBadge status={s.opinionStatus} wording="review" />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s._count.subjects}</td>
                    <td className="px-5 py-3">
                      {/* 분과 상세의 평가 의견서 페이지로 이동 */}
                      <Link
                        href={`/admin/sessions/${s.id}/opinions`}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        자세히 보기
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ApprovalBadge status={s.opinionStatus} />
                        {isMaster && (
                          <ReviewDecisionButtons sessionId={s.id} status={s.opinionStatus} kind="opinions" wording="review" />
                        )}
                      </div>
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
