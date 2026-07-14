import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/authz";
import ExcelExportButton from "@/components/ExcelExportButton";
import ExcelImportButton from "@/components/ExcelImportButton";
import CriteriaPrintButton from "@/components/CriteriaPrintButton";
import CriteriaEditor from "@/components/CriteriaEditor";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";
import CriteriaReviewPanel, { type CriteriaStatus } from "@/components/CriteriaReviewPanel";
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
  const me = await requireAdminUser();
  const isMaster = me.role === "MASTER";
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
  const cs = (session?.criteriaStatus ?? "DRAFT") as CriteriaStatus;
  // 간사 제출(SUBMITTED) 이후에만 관리자가 항목을 볼 수 있다. 제출 전(DRAFT/REJECTED)은 '입력중'.
  const adminCanView = cs === "SUBMITTED" || cs === "APPROVED";
  // 편집(추가·수정·삭제·가져오기)은 담당 간사만, 제출 전(DRAFT/REJECTED)에만. 관리자는 조회·인쇄만.
  const canEdit = !locked && !isMaster && (cs === "DRAFT" || cs === "REJECTED");
  // 관리자가 아직 항목을 볼 수 없는 상태(입력중/반려·미마감)
  const adminBlocked = isMaster && !locked && !adminCanView;

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
          {!adminBlocked && (
            <span className="ml-0.5 text-xs text-slate-400">{groupCount}개</span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {!adminBlocked && (
            <span className="text-xs text-slate-400">
              배점 합계 {totalAll}점 · 기준 만점 {session?.maxScore ?? 100}점
            </span>
          )}
          {canEdit && <ExcelImportButton sessionId={id} kind="criteria" />}
          {!adminBlocked && <CriteriaPrintButton sessionId={id} />}
          <ExcelExportButton href={`/api/sessions/${id}/export/criteria`} />
          {locked && (
            <span className="text-xs text-slate-400">마감되어 수정할 수 없습니다</span>
          )}
        </div>
      </div>

      {!locked && (
        <CriteriaReviewPanel
          sessionId={id}
          isMaster={isMaster}
          status={cs}
          rejectionReason={session?.criteriaRejectionReason ?? null}
        />
      )}

      {locked ? (
        <CriteriaPreviewTable groups={groups} />
      ) : adminBlocked ? null : canEdit ? (
        <CriteriaEditor sessionId={id} groups={groups} maxScore={session?.maxScore ?? 100} />
      ) : (
        <CriteriaPreviewTable groups={groups} />
      )}
    </div>
  );
}
