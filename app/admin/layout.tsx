import AdminSidebar from "@/components/AdminSidebar";
import AdminBreadcrumb from "@/components/AdminBreadcrumb";
import SessionBackBar from "@/components/SessionBackBar";
import ProjectTabNav from "@/components/ProjectTabNav";
import AdminContentWidth from "@/components/AdminContentWidth";
import HeaderTitle from "@/components/HeaderTitle";
import TopProgressBar from "@/components/TopProgressBar";
import { requireAdminUser } from "@/lib/authz";
import { deriveProjectStatus } from "@/lib/project-status";
import { logout } from "@/app/login/actions";
import { prisma } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminUser();
  const isMaster = user.role === "MASTER";
  const [sessions, projects] = await Promise.all([
    prisma.evaluationSession.findMany({
      where: isMaster ? {} : { secretaryId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    // 마스터=전체 사업, 담당자=참여중인 사업(project.secretaries) — 사이드바에 사업이 뜨는 기준
    prisma.project.findMany({
      where: isMaster ? {} : { secretaries: { some: { id: user.id } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        sessions: {
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, status: true },
        },
      },
    }),
  ]);
  const sessionItems = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    projectId: s.projectId,
    projectName: s.project?.name ?? null,
  }));
  const projectItems = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: deriveProjectStatus(p.sessions.map((s) => s.status)),
    sessions: p.sessions.map((s) => ({ id: s.id, name: s.name, status: s.status })),
  }));
  // 헤더 타이틀용 사업 목록 — 마스터는 전체, 담당자는 참여중인 사업
  const headerProjects = projectItems.map((p) => ({ id: p.id, name: p.name, status: p.status }));
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <TopProgressBar />
      <AdminSidebar sessions={sessionItems} projects={projectItems} role={user.role as "MASTER" | "SECRETARY"} />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-auto">
        <header className="flex items-center justify-between border-b border-slate-200 px-8 py-3">
          <HeaderTitle sessions={sessionItems} projects={headerProjects} />
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>
              <span className="font-medium text-slate-700">
                {user.name}
              </span>{" "}
              님 · {isMaster ? "마스터" : "담당자"}
            </span>
            <form action={logout}>
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:bg-slate-50">
                로그아웃
              </button>
            </form>
          </div>
        </header>
        {/* 헤더 바로 아래 현재 위치(PWD) 경로 — 관리자 전용, 분과 상세에서만 */}
        <AdminBreadcrumb sessions={sessionItems} role={user.role as "MASTER" | "SECRETARY"} />
        {/* 브레드크럼 바로 아래, 같은 좌측 라인에 '돌아가기'(분과 상세, 관리자·담당자 공통) */}
        <SessionBackBar sessions={sessionItems} />
        {/* 사업 하위 페이지의 이전/다음 탭 이동 — 콘텐츠 밖 우상단 */}
        <ProjectTabNav />
        {/* 본문 최대 폭은 페이지별로 결정 — 대부분 max-w-7xl, 사업 담당자 설정은 풀 너비 */}
        <main className="w-full flex-1 px-6 py-6">
          <AdminContentWidth>{children}</AdminContentWidth>
        </main>
      </div>
    </div>
  );
}
