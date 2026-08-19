import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertMaster } from "@/lib/authz";
import { deriveProjectStatus } from "@/lib/project-status";
import { fmtYmd } from "@/lib/dates";
import ProjectManagerTable, { type ManagedProject } from "@/components/ProjectManagerTable";

export default async function ProjectsPage() {
  await assertMaster();
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      secretaries: { select: { id: true, name: true } },
      sessions: { select: { status: true } },
    },
  });

  const rows: ManagedProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    taskType: p.taskType,
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : "",
    endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : "",
    periodLabel: p.startDate || p.endDate ? `${fmtYmd(p.startDate)} ~ ${fmtYmd(p.endDate)}` : "미정",
    status: deriveProjectStatus(p.sessions.map((s) => s.status)),
    sessionCount: p.sessions.length,
    inProgressCount: p.sessions.filter((s) => s.status === "IN_PROGRESS").length,
    secretaryNames: p.secretaries.map((s) => s.name),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">사업 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            사업을 만들고 담당자를 배정합니다. 각 담당자는 배정된 사업 아래에 분과를 구성합니다.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          + 사업 등록
        </Link>
      </div>

      <ProjectManagerTable projects={rows} />
    </div>
  );
}
