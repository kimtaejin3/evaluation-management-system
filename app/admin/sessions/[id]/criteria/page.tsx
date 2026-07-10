import { Suspense } from "react";
import { prisma } from "@/lib/db";
import ImportCriteriaButton from "@/components/ImportCriteriaButton";
import CriteriaEditor from "@/components/CriteriaEditor";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";
import { SkeletonTable } from "@/components/Skeletons";

export default async function CriteriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<SkeletonTable rows={6} cols={4} />}>
      <CriteriaContent id={id} />
    </Suspense>
  );
}

async function CriteriaContent({ id }: { id: string }) {
  const session = await prisma.evaluationSession.findUnique({ where: { id } });
  const groups = await prisma.criterionGroup.findMany({
    where: { sessionId: id },
    orderBy: { order: "asc" },
    include: {
      subitems: {
        orderBy: { order: "asc" },
        include: {
          criteria: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, maxScore: true },
          },
        },
      },
    },
  });
  const locked = session?.status === "CLOSED";

  // 총 배점 = 모든 리프(평가지표) maxScore 합
  const totalAll = groups.reduce(
    (s, g) => s + g.subitems.reduce((s2, sub) => s2 + sub.criteria.reduce((s3, c) => s3 + c.maxScore, 0), 0),
    0,
  );
  const groupCount = groups.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="text-sm font-semibold text-slate-700">
          평가 항목{" "}
          <span className="ml-0.5 text-xs text-slate-400">
            {groupCount}개
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            배점 합계 {totalAll}점 · 기준 만점 {session?.maxScore ?? 100}점
          </span>
          {locked ? (
            <span className="text-xs text-slate-400">마감되어 수정할 수 없습니다</span>
          ) : (
            <ImportCriteriaButton sessionId={id} />
          )}
        </div>
      </div>

      {locked ? (
        <CriteriaPreviewTable groups={groups} />
      ) : (
        <CriteriaEditor sessionId={id} groups={groups} maxScore={session?.maxScore ?? 100} />
      )}
    </div>
  );
}
