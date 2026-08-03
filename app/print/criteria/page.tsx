import { notFound } from "next/navigation";
import Link from "next/link";
import { assertSessionAccess, assertProjectAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import AutoPrint from "@/app/print/sheet/AutoPrint";
import PrintButton from "@/app/admin/sessions/[id]/results/PrintButton";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";

// 평가항목(평가지) 인쇄 — 관리자 레이아웃(사이드바) 없이 문서만 렌더. 자체 인증.
// 평가항목은 사업(Project) 단위 공통 — projectId(사업 페이지) 또는 sessionId(분과 페이지)로 진입.
// embed=1 이면 미리보기 iframe 임베드용으로 화면 툴바를 숨긴다.
export default async function CriteriaPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; projectId?: string; embed?: string }>;
}) {
  const { sessionId, projectId: projectIdParam, embed } = await searchParams;
  const embedded = embed === "1";

  // 접근 검증 + 헤더 정보 결정
  let projectId: string | null = null;
  let title: string;
  let projectName: string | null = null;
  let taskType: string | null = null;
  let maxScore = 100;
  let backHref: string;

  if (projectIdParam) {
    const { project } = await assertProjectAccess(projectIdParam);
    projectId = project.id;
    title = `${project.name} 평가표`;
    projectName = project.name;
    taskType = project.taskType;
    maxScore = project.maxScore;
    backHref = `/admin/projects/${project.id}/criteria`;
  } else if (sessionId) {
    await assertSessionAccess(sessionId);
    const session = await prisma.evaluationSession.findUnique({
      where: { id: sessionId },
      include: { project: { select: { id: true, name: true, taskType: true, maxScore: true } } },
    });
    if (!session) notFound();
    projectId = session.project?.id ?? null;
    title = `${session.name} 평가표`;
    projectName = session.project?.name ?? null;
    taskType = session.project?.taskType ?? null;
    maxScore = session.project?.maxScore ?? session.maxScore;
    backHref = `/admin/sessions/${sessionId}/criteria`;
  } else {
    notFound();
  }

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

  const printedDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 14mm; }`}</style>
      <AutoPrint />

      {/* 화면 전용 툴바 — 미리보기 임베드(embed=1)에선 숨김 */}
      {!embedded && (
        <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
          <Link
            href={backHref}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            ← 평가항목으로
          </Link>
          <PrintButton />
        </div>
      )}

      <div className="mx-auto max-w-[210mm] rounded-xl bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="mb-5 border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500">
            {projectName && <span>사업 {projectName}</span>}
            {taskType && <span>사업유형 {taskType}</span>}
            <span>기준 만점 {maxScore}점</span>
            <span className="ml-auto">출력일 {printedDate}</span>
          </div>
        </header>

        <CriteriaPreviewTable groups={groups} />
      </div>
    </div>
  );
}
