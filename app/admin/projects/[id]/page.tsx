import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { deriveProjectStatus } from "@/lib/project-status";
import { assignSecretaryToProject, removeSecretaryFromProject, deleteProject } from "../actions";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "준비중", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  IN_PROGRESS: { label: "진행중", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  CLOSED: { label: "마감", cls: "bg-slate-200 text-slate-600 ring-slate-300" },
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await assertProjectAccess(id);
  const isMaster = user.role === "MASTER";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      secretaries: { select: { id: true, name: true, username: true } },
      sessions: { orderBy: { createdAt: "desc" }, include: { secretary: { select: { name: true } } } },
    },
  });
  if (!project) return null;

  const assignedIds = project.secretaries.map((s) => s.id);
  // 배정 후보: 아직 배정되지 않은 간사(SECRETARY)
  const availableSecretaries = isMaster
    ? await prisma.user.findMany({
        where: { role: "SECRETARY", id: { notIn: assignedIds.length ? assignedIds : [""] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, username: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-slate-400 hover:text-slate-600">
          ← 과제 목록
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {(() => {
              const st = STATUS[deriveProjectStatus(project.sessions.map((s) => s.status))];
              return (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${st.cls}`}>
                  {st.label}
                </span>
              );
            })()}
          </div>
          {isMaster && (
            <form action={async () => { "use server"; await deleteProject(id); }}>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-rose-600 transition hover:bg-rose-50">
                과제 삭제
              </button>
            </form>
          )}
        </div>
        {project.description && <p className="mt-1 text-sm text-slate-600">{project.description}</p>}
      </div>

      {/* 담당 간사 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 text-sm font-semibold text-slate-700">담당 간사</div>
        {project.secretaries.length === 0 ? (
          <p className="text-sm text-slate-400">배정된 간사가 없습니다.</p>
        ) : (
          <ul className="space-y-1.5">
            {project.secretaries.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {s.name} <span className="text-slate-400">· {s.username}</span>
                </span>
                {isMaster && (
                  <form action={async () => { "use server"; await removeSecretaryFromProject(id, s.id); }}>
                    <button className="text-xs text-rose-600 hover:underline">배정 해제</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {isMaster && (
          <form action={assignSecretaryToProject.bind(null, id)} className="mt-3 flex gap-2">
            <select name="userId" defaultValue="" required className={`flex-1 ${inputCls}`}>
              <option value="" disabled>간사 선택 (평가위원 관리에서 등록)</option>
              {availableSecretaries.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.username}</option>
              ))}
            </select>
            <button disabled={availableSecretaries.length === 0} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
              배정
            </button>
          </form>
        )}
      </div>

      {/* 소속 분과 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="font-semibold">소속 분과 ({project.sessions.length})</div>
          <Link
            href={`/admin/sessions/new?projectId=${id}`}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            + 분과 추가
          </Link>
        </div>
        {project.sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {project.sessions.map((s) => {
              const st = STATUS[s.status] ?? { label: s.status, cls: "bg-slate-100 text-slate-600 ring-slate-200" };
              return (
                <li key={s.id}>
                  <Link href={`/admin/sessions/${s.id}`} className="flex items-center justify-between px-5 py-3 transition hover:bg-slate-50">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">간사 {s.secretary?.name ?? "미배정"}</span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${st.cls}`}>{st.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
