import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import ProjectSubjectsBrowser, { type BrowserSession } from "@/components/ProjectSubjectsBrowser";
import ExcelExportButton from "@/components/ExcelExportButton";
import { SkeletonTable } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 사업 평가대상 — 분과 단위 행으로 한눈에.
// 분과명 클릭 → 분과 평가 대상 페이지(기업 자료 제출 조회), 점수 '자세히 보기' → 위원별 점수 매트릭스.
export default async function ProjectSubjectsPage({
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
          <h1 className="mt-1 text-2xl font-bold">평가대상</h1>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/subjects`} />
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={5} />}>
        <Content id={id} />
      </Suspense>
      <p className="text-left text-xs text-slate-400">
        분과 탭을 선택하면 그 분과의 평가 대상(기업)을 이 화면에서 바로 보고 추가·수정·삭제·서류 관리까지 할 수 있습니다.
      </p>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  await assertProjectAccess(id);
  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      secretary: { select: { name: true } },
      status: true,
      // 분과별 평가 대상 + 기업 정보 + 제출 자료(분과 전용 + 공통)를 한 번에
      subjects: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          sessionId: true,
          companyId: true,
          status: true,
          rejectionReason: true,
          company: {
            select: {
              businessNo: true,
              region: true,
              leadResearcher: true,
              description: true,
              documents: {
                orderBy: { createdAt: "asc" },
                select: { id: true, originalName: true, size: true, sessionId: true },
              },
            },
          },
        },
      },
    },
  });

  const data: BrowserSession[] = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    secretaryName: s.secretary?.name ?? null,
    locked: s.status === "CLOSED",
    subjects: s.subjects.map((sub) => ({
      id: sub.id,
      companyId: sub.companyId,
      name: sub.name,
      status: sub.status as BrowserSession["subjects"][number]["status"],
      rejectionReason: sub.rejectionReason,
      businessNo: sub.company.businessNo,
      region: sub.company.region,
      leadResearcher: sub.company.leadResearcher,
      description: sub.company.description,
      // 이 분과 전용 자료 + 공통(sessionId=null) 자료만
      documents: sub.company.documents
        .filter((d) => d.sessionId === sub.sessionId || d.sessionId === null)
        .map((d) => ({ id: d.id, originalName: d.originalName, size: d.size })),
    })),
  }));

  return <ProjectSubjectsBrowser sessions={data} />;
}
