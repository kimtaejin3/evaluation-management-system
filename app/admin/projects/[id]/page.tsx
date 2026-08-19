import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { fmtYmd } from "@/lib/dates";
import SessionSecretaryCell from "@/components/SessionSecretaryCell";
import ProjectSessionsTable, { type ProjectSessionRow } from "@/components/ProjectSessionsTable";
import type { ReactNode } from "react";


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

  // 담당자에게는 본인이 담당(secretaryId)인 분과만 노출(미배정·타 담당자 분과 숨김). 마스터는 전체.
  // 정렬은 표(클라이언트) 헤더에서 처리.
  const visibleSessions = isMaster
    ? project.sessions
    : project.sessions.filter((s) => s.secretaryId === user.id);

  // 전역 담당자 풀(담당자 관리) — 분과 설정에서 별도 '담당자 추가' 없이 그대로 보여주고,
  // 분과 배정도 이 풀에서 바로 선택한다(배정 시 사업에 자동 연결됨).
  const secretaries = isMaster
    ? await prisma.user.findMany({
        where: { role: "SECRETARY" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          username: true,
          phone: true,
          tempPassword: true,
          assignedProjects: { select: { name: true }, orderBy: { createdAt: "desc" } },
        },
      })
    : [];
  // 분과 표(클라이언트) 행 데이터 + 담당자 셀(서버에서 렌더해 노드로 전달)
  const sessionRows: ProjectSessionRow[] = visibleSessions.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status as ProjectSessionRow["status"],
    periodLabel:
      s.startDate || s.endDate
        ? `${fmtYmd(s.startDate)} ~ ${fmtYmd(s.endDate)}`
        : s.eventDate
          ? fmtYmd(s.eventDate)
          : "미정",
    startDate: s.startDate ? s.startDate.toISOString().slice(0, 10) : "",
    endDate: s.endDate ? s.endDate.toISOString().slice(0, 10) : "",
    subjectCount: s._count.subjects,
    assignmentCount: s._count.assignments,
    secretaryName: s.secretary?.name ?? null,
  }));
  const secretaryCells: Record<string, ReactNode> = Object.fromEntries(
    visibleSessions.map((s) => [
      s.id,
      isMaster ? (
        <SessionSecretaryCell
          key={s.id}
          projectId={id}
          sessionId={s.id}
          sessionName={s.name}
          secretaryName={s.secretary?.name ?? null}
          secretaries={secretaries}
        />
      ) : s.secretary?.name ? (
        <span className="text-slate-700">{s.secretary.name}</span>
      ) : (
        <span className="text-xs text-rose-600">미배정</span>
      ),
    ]),
  );

  // 담당자별 이 사업 내 담당 분과
  const sessionsOfSecretary = new Map<string, string[]>();
  for (const s of project.sessions) {
    if (!s.secretaryId) continue;
    if (!sessionsOfSecretary.has(s.secretaryId)) sessionsOfSecretary.set(s.secretaryId, []);
    sessionsOfSecretary.get(s.secretaryId)!.push(s.name);
  }


  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        {/* 제목 옆에 기간만 인라인 배치 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {(project.startDate || project.endDate) && (
              <span className="text-sm text-slate-500">
                기간 {fmtYmd(project.startDate)} ~ {fmtYmd(project.endDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 소속 분과 — 버튼은 카드 밖(배경), 표만 카드 안.
          분과 추가는 담당자·관리자 모두 가능(관리자는 생성 시 담당자 선택).
          담당자 배정/해제는 표의 '담당자' 셀에서 행 단위로 한다. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            분과 설정 <span className="ml-0.5 text-xs text-slate-400">{visibleSessions.length}개</span>
          </h2>
          <Link
            href={`/admin/sessions/new?projectId=${id}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
          >
            + 분과 추가
          </Link>
        </div>
        {/* 체크박스 상시 + 하단 우측 '분과 정보 변경'(수정·삭제 통합) — 담당자·관리자 공용 */}
        <ProjectSessionsTable
          projectId={id}
          rows={sessionRows}
          secretaryCells={secretaryCells}
          emptyLabel={
            isMaster ? "아직 분과가 없습니다. ‘분과 추가’로 시작하세요." : "내가 만든 분과가 없습니다. ‘분과 추가’로 시작하세요."
          }
        />
      </div>

      {/* 화면 맨 밑(사업 정보 변경 아래, 관리자 전용): 담당자 관리에 등록된 전역 담당자 풀 현황.
          별도 '담당자 추가' 없이, 위 분과 표의 '담당자' 셀에서 이 풀 중에서 배정한다. */}
      {isMaster && (
        <div className="mt-auto space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              담당자 현황 <span className="ml-0.5 text-xs text-slate-400">{secretaries.length}명</span>
              <span className="ml-2 text-xs font-normal text-slate-400">담당자 관리에 등록된 담당자 전체</span>
            </h2>
          </div>
          {/* 담당자가 많아도 화면이 커지지 않도록 약 3행만 보이고 스크롤(고객 요청) */}
          <div className="thin-scrollbar max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-2.5 font-medium">이름</th>
                  <th className="px-5 py-2.5 font-medium">아이디</th>
                  <th className="px-5 py-2.5 font-medium">비밀번호</th>
                  <th className="px-5 py-2.5 font-medium">연락처</th>
                  <th className="px-5 py-2.5 font-medium">참여 사업</th>
                  <th className="px-5 py-2.5 font-medium">담당 분과</th>
                </tr>
              </thead>
              <tbody>
                {secretaries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                      등록된 담당자가 없습니다. ‘담당자 관리’에서 먼저 담당자를 등록하세요.
                    </td>
                  </tr>
                )}
                {secretaries.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{u.name}</td>
                    <td className="px-5 py-2.5 text-slate-600">{u.username}</td>
                    <td className="px-5 py-2.5">
                      {u.tempPassword ? (
                        <span className="font-mono text-sm tabular-nums text-slate-700">{u.tempPassword}</span>
                      ) : (
                        <span className="text-xs text-slate-400">재발급 필요</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {u.phone ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      {u.assignedProjects.length > 0 ? (
                        <span className="flex flex-wrap justify-center gap-1">
                          {u.assignedProjects.map((p) => (
                            <span key={p.name} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {p.name}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">참여 없음</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {sessionsOfSecretary.has(u.id) ? (
                        <span className="flex flex-wrap justify-center gap-1">
                          {sessionsOfSecretary.get(u.id)!.map((name) => (
                            <span key={name} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {name}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">배정 없음</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
