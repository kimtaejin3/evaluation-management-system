import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import ExcelExportButton from "@/components/ExcelExportButton";
import SessionUrlPicker from "@/components/SessionUrlPicker";
import OpinionsContent from "@/app/admin/sessions/[id]/opinions/OpinionsContent";
import { SkeletonCard } from "@/components/Skeletons";

// 사업 평가의견서 — 분과를 골라 그 분과의 의견서 화면(위원장 종합의견·지원기업별 총점)을
// 이 페이지에 그대로 임베드한다(회의 결정: '자세히 보기' 이동 제거).
export default async function ProjectOpinionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-bold">평가의견서</h1>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/opinions`} />
      </div>
      <Suspense
        fallback={
          <div className="space-y-6">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
        }
      >
        <Content id={id} sessionParam={session} />
      </Suspense>
      <p className="text-left text-xs text-slate-400">
        분과를 선택하면 그 분과의 평가위원장 종합의견과 지원기업별 총점·의견을 바로 볼 수 있습니다.
      </p>
    </div>
  );
}

async function Content({ id, sessionParam }: { id: string; sessionParam?: string }) {
  await assertProjectAccess(id);
  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
        아직 분과가 없습니다.
      </div>
    );
  }
  const selected = sessions.find((s) => s.id === sessionParam)?.id ?? sessions[0].id;

  return (
    <div className="space-y-4">
      <SessionUrlPicker sessions={sessions} current={selected} />
      {/* 선택 분과의 의견서 화면을 그대로 임베드 — 분과 페이지와 동일 컴포넌트 */}
      <OpinionsContent id={selected} />
    </div>
  );
}
