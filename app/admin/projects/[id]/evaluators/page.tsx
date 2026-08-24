import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import ExcelExportButton from "@/components/ExcelExportButton";
import ProjectEvaluatorsTable, { type EvaluatorSessionGroup } from "@/components/ProjectEvaluatorsTable";
import { SkeletonTable } from "@/components/Skeletons";

// 사업 평가위원 선정현황 — 분과별 위원 배정을 한눈에 보고, 분과 중심으로 배정을 미세 조정한다.
// (여러 명 일괄 배정은 평가위원 관리의 '사업 및 분과 일괄 설정'에서. 위원장 지정은 담당자만.)
export default async function ProjectEvaluatorsPage({
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
          <h1 className="mt-1 text-2xl font-bold">평가위원 선정현황</h1>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/evaluators`} />
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={5} />}>
        <Content id={id} />
      </Suspense>
      <p className="text-left text-xs text-slate-400">
        분과별 위원 배정 현황입니다. 마지막 열의 +로 배정하고 ✕로 해제합니다. 위원장 지정은 담당자가 분과 페이지에서 합니다.
      </p>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  await assertProjectAccess(id);
  const [sessions, pool] = await Promise.all([
    prisma.evaluationSession.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        chairId: true,
        assignments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            userId: true,
            user: { select: { name: true, username: true, phone: true, tempPassword: true } },
          },
        },
      },
    }),
    // 전역 평가위원 풀 — '+ 위원 추가' 후보
    prisma.user.findMany({
      where: { role: "EVALUATOR" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, username: true },
    }),
  ]);

  const groups: EvaluatorSessionGroup[] = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    chairId: s.chairId,
    closed: s.status === "CLOSED",
    assignments: s.assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      name: a.user.name,
      username: a.user.username,
      phone: a.user.phone,
      tempPassword: a.user.tempPassword,
    })),
  }));

  return <ProjectEvaluatorsTable sessions={groups} pool={pool} />;
}
