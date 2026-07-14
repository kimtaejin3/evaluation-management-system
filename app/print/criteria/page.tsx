import { notFound } from "next/navigation";
import Link from "next/link";
import { assertSessionAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import AutoPrint from "@/app/print/sheet/AutoPrint";
import PrintButton from "@/app/admin/sessions/[id]/results/PrintButton";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";

// 평가항목(평가지) 인쇄 — 관리자 레이아웃(사이드바) 없이 문서만 렌더. 자체 인증(assertSessionAccess).
// embed=1 이면 미리보기 iframe 임베드용으로 화면 툴바를 숨긴다.
export default async function CriteriaPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; embed?: string }>;
}) {
  const { sessionId, embed } = await searchParams;
  if (!sessionId) notFound();
  const embedded = embed === "1";
  const { user } = await assertSessionAccess(sessionId);

  const printedDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [session, groups] = await Promise.all([
    prisma.evaluationSession.findUnique({
      where: { id: sessionId },
      include: { project: { select: { name: true, taskType: true } } },
    }),
    prisma.criterionGroup.findMany({
      where: { sessionId },
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
    }),
  ]);
  if (!session) notFound();

  // 관리자는 간사 제출(SUBMITTED/APPROVED) 또는 마감(CLOSED) 이후에만 평가 항목을 볼 수 있다(입력중 인쇄 차단).
  const adminCanView =
    session.criteriaStatus === "SUBMITTED" ||
    session.criteriaStatus === "APPROVED" ||
    session.status === "CLOSED";
  if (user.role === "MASTER" && !adminCanView) notFound();

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 14mm; }`}</style>
      <AutoPrint />

      {/* 화면 전용 툴바 — 미리보기 임베드(embed=1)에선 숨김 */}
      {!embedded && (
        <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
          <Link
            href={`/admin/sessions/${sessionId}/criteria`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            ← 평가항목으로
          </Link>
          <PrintButton />
        </div>
      )}

      <div className="mx-auto max-w-[210mm] rounded-xl bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="mb-5 border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-900">{session.name} 평가표</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500">
            {session.project?.name && <span>과제 {session.project.name}</span>}
            {session.project?.taskType && <span>과제유형 {session.project.taskType}</span>}
            <span>기준 만점 {session.maxScore}점</span>
            <span className="ml-auto">출력일 {printedDate}</span>
          </div>
        </header>

        <CriteriaPreviewTable groups={groups} />
      </div>
    </div>
  );
}
