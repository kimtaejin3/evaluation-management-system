import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/authz";
import ExcelExportButton from "@/components/ExcelExportButton";
import CriteriaPrintButton from "@/components/CriteriaPrintButton";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";
import CriteriaAckPanel from "@/components/CriteriaAckPanel";
import { SkeletonTable } from "@/components/Skeletons";

// 평가항목은 사업(Project) 단위 — 관리자가 사업 페이지에서 작성하고, 분과 화면에서는
// 모두 조회 전용이다. 담당자는 내용 검토 후 '확인'(ack)만 한다.
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
  const session = await prisma.evaluationSession.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true, maxScore: true } } },
  });
  const projectId = session?.project?.id ?? null;
  const groups = projectId
    ? await prisma.criterionGroup.findMany({
        where: { projectId },
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
      })
    : [];

  // 총 배점 — 통합배점 세부항목은 sub.maxScore 하나로, 지표별 세부항목은 지표 합으로 계산
  const totalAll = groups.reduce(
    (s, g) =>
      s + g.subitems.reduce((s2, sub) => s2 + (sub.maxScore ?? sub.criteria.reduce((s3, c) => s3 + c.maxScore, 0)), 0),
    0,
  );
  const hasCriteria = groups.some((g) => g.subitems.some((sub) => sub.criteria.length > 0));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="text-sm font-semibold text-slate-700">
          평가 항목{" "}
          <span className="ml-0.5 text-xs text-slate-400">
            {session?.project?.name ? `${session.project.name} 공통` : ""} {groups.length}개
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            배점 합계 {totalAll}점 · 기준 만점 {session?.project?.maxScore ?? session?.maxScore ?? 100}점
          </span>
          <CriteriaPrintButton sessionId={id} />
          <ExcelExportButton href={`/api/sessions/${id}/export/criteria`} />
          {isMaster && projectId && (
            <Link
              href={`/admin/projects/${projectId}/criteria`}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              사업 평가항목 편집
            </Link>
          )}
        </div>
      </div>

      {/* 담당자: 확인 패널(확인 전/후). 관리자: 편집은 사업 페이지에서. */}
      {!isMaster && (
        <CriteriaAckPanel
          sessionId={id}
          ackAt={session?.criteriaAckAt ? session.criteriaAckAt.toISOString() : null}
          hasCriteria={hasCriteria}
        />
      )}

      {!projectId ? (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
          이 분과는 소속 사업이 없어 평가항목을 표시할 수 없습니다.
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
          아직 관리자가 등록한 평가항목이 없습니다.
        </p>
      ) : (
        <CriteriaPreviewTable groups={groups} />
      )}
    </div>
  );
}
