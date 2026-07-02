import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertMaster } from "@/lib/authz";
import { deriveProjectStatus } from "@/lib/project-status";

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "준비중", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  IN_PROGRESS: { label: "진행중", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  CLOSED: { label: "마감", cls: "bg-slate-200 text-slate-600 ring-slate-300" },
};

export default async function ProjectsPage() {
  await assertMaster();
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      secretaries: { select: { id: true, name: true } },
      sessions: { select: { status: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">과제 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            과제를 만들고 담당 간사를 배정합니다. 각 간사는 배정된 과제 아래에 분과를 구성합니다.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          + 새 과제
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          등록된 과제가 없습니다. 위에서 새 과제를 만드세요.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => {
            const total = p.sessions.length;
            const inProgress = p.sessions.filter((s) => s.status === "IN_PROGRESS").length;
            const st = STATUS[deriveProjectStatus(p.sessions.map((s) => s.status))];
            return (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5">분과 {total}개{inProgress > 0 ? ` · 진행중 ${inProgress}` : ""}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5">
                    담당 간사 {p.secretaries.length === 0 ? "미배정" : p.secretaries.map((s) => s.name).join(", ")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
