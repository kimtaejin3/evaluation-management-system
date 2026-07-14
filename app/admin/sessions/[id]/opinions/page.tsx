import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/authz";
import { SkeletonCard } from "@/components/Skeletons";
import ExcelExportButton from "@/components/ExcelExportButton";
import ReviewWorkflowPanel, { type ReviewStatus } from "@/components/ReviewWorkflowPanel";
import {
  submitOpinions,
  cancelSubmitOpinions,
  approveOpinions,
  rejectOpinions,
} from "../../actions";
import OpinionViewer from "./OpinionViewer";

export default async function OpinionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      }
    >
      <OpinionsContent id={id} />
    </Suspense>
  );
}

async function OpinionsContent({ id }: { id: string }) {
  const me = await requireAdminUser();
  const isMaster = me.role === "MASTER";
  const [session, assignments, subjects, opinions] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: { select: { id: true, name: true } } } }),
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { name: "asc" } }),
    prisma.opinion.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, text: true } }),
  ]);

  // (위원:대상) → 종합의견 텍스트
  const opinionOf = new Map<string, string>();
  for (const o of opinions) if (o.text.trim()) opinionOf.set(`${o.evaluatorId}:${o.subjectId}`, o.text);

  // 위원장을 맨 앞에
  const chairId = session?.chairId ?? null;
  const evaluators = [...assignments]
    .sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))
    .map((a) => ({ id: a.userId, name: a.user.name, isChair: a.userId === chairId }));

  const subjectNameOf = new Map(subjects.map((s) => [s.id, s.name]));

  // 텍스트가 있는 (위원 × 지원기업) 조합만 flat 리스트로 구성
  const items = evaluators
    .flatMap((ev) =>
      subjects
        .filter((s) => opinionOf.has(`${ev.id}:${s.id}`))
        .map((s) => ({
          evaluatorId: ev.id,
          evaluatorName: ev.name,
          isChair: ev.isChair,
          subjectId: s.id,
          subjectName: subjectNameOf.get(s.id) ?? "",
          text: opinionOf.get(`${ev.id}:${s.id}`) ?? "",
        })),
    )
    .filter((item) => item.subjectName);

  const locked = session?.status === "CLOSED";
  const os = (session?.opinionStatus ?? "DRAFT") as ReviewStatus;
  // 간사 제출(SUBMITTED) 이후에만 관리자가 의견서를 볼 수 있다.
  const adminCanView = os === "SUBMITTED" || os === "APPROVED";
  const adminBlocked = isMaster && !locked && !adminCanView;

  return (
    <div className="space-y-4">
      {/* 상단: 안내 + 엑셀 내보내기(역할·상태 무관 고정) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <p className="text-sm text-slate-500">
          평가위원이 각 지원기업에 대해 평가 화면에서 작성한 종합의견입니다.
        </p>
        <ExcelExportButton href={`/api/sessions/${id}/export/opinions`} />
      </div>

      {/* 검토 워크플로 배너 — 간사: 제출/취소, 관리자: 승인/반려 */}
      {!locked && (
        <ReviewWorkflowPanel
          sessionId={id}
          isMaster={isMaster}
          status={os}
          rejectionReason={session?.opinionRejectionReason ?? null}
          draftBadge="취합중"
          onSubmit={submitOpinions}
          onCancelSubmit={cancelSubmitOpinions}
          onApprove={approveOpinions}
          onReject={rejectOpinions}
        />
      )}

      {adminBlocked ? null : evaluators.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-slate-400">
          배정된 평가위원이 없습니다.
        </div>
      ) : (
        <OpinionViewer items={items} />
      )}
    </div>
  );
}
