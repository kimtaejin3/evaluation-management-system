import AdminSidebar from "@/components/AdminSidebar";
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
      select: { id: true, name: true, status: true },
    }),
    isMaster
      ? prisma.project.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, sessions: { select: { status: true } } },
        })
      : Promise.resolve([]),
  ]);
  const projectItems = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: deriveProjectStatus(p.sessions.map((s) => s.status)),
  }));
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <TopProgressBar />
      <AdminSidebar sessions={sessions} projects={projectItems} role={user.role as "MASTER" | "SECRETARY"} />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-auto">
        <header className="flex items-center justify-between border-b border-slate-200 px-8 py-3">
          <HeaderTitle sessions={sessions} />
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>
              <span className="font-medium text-slate-700">
                {user.name}
              </span>{" "}
              님 · {isMaster ? "마스터" : "간사"}
            </span>
            <form action={logout}>
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:bg-slate-50">
                로그아웃
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
