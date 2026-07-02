import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { deriveProjectStatus } from "@/lib/project-status";
import {
  assignSecretaryToSession,
  createSecretaryAndAssignToSession,
  unassignSessionSecretary,
  deleteProject,
} from "../actions";

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
      sessions: { orderBy: { createdAt: "desc" }, include: { secretary: { select: { name: true } } } },
    },
  });
  if (!project) return null;

  // 기존 간사 후보(전체 SECRETARY) — 배정 시 분과에 바로 매핑
  const allSecretaries = isMaster
    ? await prisma.user.findMany({
        where: { role: "SECRETARY" },
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

      {/* 간사 배정 — 간사를 (기존 선택 또는 신규 생성) 분과에 바로 배정 */}
      {isMaster && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 text-sm font-semibold text-slate-700">간사 배정</div>
          {project.sessions.length === 0 ? (
            <p className="text-sm text-slate-400">먼저 아래에서 분과를 추가한 뒤 간사를 배정하세요.</p>
          ) : (
            <div className="space-y-3">
              {/* 기존 간사를 분과에 배정 */}
              <form action={assignSecretaryToSession.bind(null, id)} className="flex flex-wrap items-end gap-2">
                <select name="sessionId" required defaultValue="" className={`min-w-40 flex-1 ${inputCls}`}>
                  <option value="" disabled>대상 분과</option>
                  {project.sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select name="userId" required defaultValue="" className={`min-w-40 flex-1 ${inputCls}`}>
                  <option value="" disabled>기존 간사 선택</option>
                  {allSecretaries.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {s.username}</option>
                  ))}
                </select>
                <button disabled={allSecretaries.length === 0} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
                  배정
                </button>
              </form>
              {/* 새 간사 만들어 분과에 배정 */}
              <form action={createSecretaryAndAssignToSession.bind(null, id)} className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <div className="col-span-2 text-xs font-medium text-slate-500">새 간사 만들어 분과에 배정</div>
                <select name="sessionId" required defaultValue="" className={`col-span-2 ${inputCls}`}>
                  <option value="" disabled>대상 분과</option>
                  {project.sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input name="name" placeholder="이름" required className={inputCls} />
                <input name="username" placeholder="아이디" required className={inputCls} />
                <input name="phone" placeholder="연락처 (예: 010-1234-5678)" required className={`col-span-2 ${inputCls}`} />
                <button className="col-span-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100">
                  + 간사 생성·배정
                </button>
                <p className="col-span-2 text-xs text-slate-400">임시 비밀번호는 연락처 끝 4자리로 발급됩니다.</p>
              </form>
            </div>
          )}
        </div>
      )}

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
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/admin/sessions/${s.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-indigo-700 hover:underline">
                    {s.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="text-slate-400">
                      간사 {s.secretary?.name ?? "미배정"}
                    </span>
                    {isMaster && s.secretaryId && (
                      <form action={async () => { "use server"; await unassignSessionSecretary(id, s.id); }}>
                        <button className="text-rose-600 hover:underline">해제</button>
                      </form>
                    )}
                    <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${st.cls}`}>{st.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
