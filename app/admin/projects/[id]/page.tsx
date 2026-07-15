import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { deriveProjectStatus } from "@/lib/project-status";
import StatusBadge from "@/components/StatusBadge";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import { unassignSessionSecretary } from "../actions";

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
      sessions: {
        orderBy: { createdAt: "desc" },
        include: {
          secretary: { select: { name: true } },
          _count: { select: { subjects: true, assignments: true } },
        },
      },
    },
  });
  if (!project) return null;

  // 간사에게는 본인이 담당(secretaryId)인 분과만 노출(미배정·타 간사 분과 숨김). 마스터는 전체.
  const visibleSessions = isMaster
    ? project.sessions
    : project.sessions.filter((s) => s.secretaryId === user.id);


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
            <DeleteProjectButton projectId={id} projectName={project.name} sessionCount={project.sessions.length} />
          )}
        </div>
        {project.description && <p className="mt-1 text-sm text-slate-600">{project.description}</p>}
      </div>

      {/* 소속 분과 — 버튼은 카드 밖(배경), 표만 카드 안 */}
      <div className="space-y-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/admin/sessions/new?projectId=${id}`}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            + 분과 추가
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {visibleSessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다. ‘분과 추가’로 시작하세요.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">평가 상태</th>
                <th className="px-5 py-3 font-medium">평가일자</th>
                <th className="px-5 py-3 font-medium">평가 대상 수</th>
                <th className="px-5 py-3 font-medium">평가위원 수</th>
                <th className="px-5 py-3 font-medium">담당 간사</th>
              </tr>
            </thead>
            <tbody>
              {visibleSessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/sessions/${s.id}`} className="font-medium text-slate-800 hover:text-indigo-700 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.eventDate
                      ? new Date(s.eventDate).toLocaleDateString("ko-KR")
                      : "미정"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s._count.subjects}</td>
                  <td className="px-5 py-3 text-slate-600">{s._count.assignments}</td>
                  <td className="px-5 py-3">
                    {s.secretary?.name ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-slate-700">{s.secretary.name}</span>
                        {isMaster && s.secretaryId && (
                          <form action={async () => { "use server"; await unassignSessionSecretary(id, s.id); }}>
                            <button className="text-xs text-slate-400 hover:text-rose-600 hover:underline">해제</button>
                          </form>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">미배정</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>
    </div>
  );
}
