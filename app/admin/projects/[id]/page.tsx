import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { fmtYmd } from "@/lib/dates";
import StatusBadge from "@/components/StatusBadge";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import SessionSecretaryCell from "@/components/SessionSecretaryCell";
import UserPasswordManager from "@/components/UserPasswordManager";
import ExcelExportButton from "@/components/ExcelExportButton";
import SortableTh from "@/components/SortableTh";
import { parseSessionSort, sortSessions } from "@/lib/session-sort";
import { removeSecretaryFromProject } from "../actions";
import AddProjectSecretaryModal from "@/components/AddProjectSecretaryModal";


export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const { id } = await params;
  const { sort, dir } = parseSessionSort(await searchParams);
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
      // 참여 간사(간사 풀에서 이 과제에 추가된 사람들)
      secretaries: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, username: true, phone: true, employeeNo: true, tempPassword: true },
      },
    },
  });
  if (!project) return null;

  // 간사에게는 본인이 담당(secretaryId)인 분과만 노출(미배정·타 간사 분과 숨김). 마스터는 전체.
  // 분과명·평가 기간 헤더 클릭 정렬(?sort=&dir=) 적용.
  const visibleSessions = sortSessions(
    isMaster ? project.sessions : project.sessions.filter((s) => s.secretaryId === user.id),
    sort,
    dir,
  );

  // 참여 간사(이 과제) — 담당 배정 모달 + 하단 간사 테이블 공용.
  // 추가 후보 = 간사 풀(간사 관리)에서 아직 이 과제에 참여하지 않은 간사.
  const secretaries = project.secretaries;
  const candidates = isMaster
    ? await prisma.user.findMany({
        where: { role: "SECRETARY", id: { notIn: secretaries.map((s) => s.id) } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, username: true },
      })
    : [];
  // 간사별 이 과제 내 담당 분과
  const sessionsOfSecretary = new Map<string, string[]>();
  for (const s of project.sessions) {
    if (!s.secretaryId) continue;
    if (!sessionsOfSecretary.has(s.secretaryId)) sessionsOfSecretary.set(s.secretaryId, []);
    sessionsOfSecretary.get(s.secretaryId)!.push(s.name);
  }


  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-slate-400 hover:text-slate-600">
          ← 과제 목록
        </Link>
        {/* 제목 옆에 기간만 인라인 배치 */}
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {(project.startDate || project.endDate) && (
              <span className="text-sm text-slate-500">
                기간 {fmtYmd(project.startDate)} ~ {fmtYmd(project.endDate)}
              </span>
            )}
          </div>
          {isMaster && (
            <DeleteProjectButton projectId={id} projectName={project.name} sessionCount={project.sessions.length} />
          )}
        </div>
      </div>

      {/* 소속 분과 — 버튼은 카드 밖(배경), 표만 카드 안.
          분과 추가는 간사·관리자 모두 가능(관리자는 생성 시 담당 간사 선택).
          간사 배정/해제는 표의 '담당 간사' 셀에서 행 단위로 한다. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            분과 간사 설정 <span className="ml-0.5 text-xs text-slate-400">{visibleSessions.length}개</span>
          </h2>
          <div className="flex items-center gap-2">
            <ExcelExportButton href={`/api/projects/${id}/export/sessions`} />
            <Link
              href={`/admin/sessions/new?projectId=${id}`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
            >
              + 분과 추가
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {visibleSessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            {isMaster ? "아직 분과가 없습니다. ‘분과 추가’로 시작하세요." : "내가 만든 분과가 없습니다. ‘분과 추가’로 시작하세요."}
          </p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <SortableTh label="분과명" field="name" sort={sort} dir={dir} basePath={`/admin/projects/${id}`} />
                <th className="px-5 py-3 font-medium">평가 상태</th>
                <SortableTh label="평가 기간" field="period" sort={sort} dir={dir} basePath={`/admin/projects/${id}`} />
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
                    {s.startDate || s.endDate
                      ? `${fmtYmd(s.startDate)} ~ ${fmtYmd(s.endDate)}`
                      : s.eventDate
                        ? fmtYmd(s.eventDate)
                        : "미정"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s._count.subjects}</td>
                  <td className="px-5 py-3 text-slate-600">{s._count.assignments}</td>
                  <td className="px-5 py-3">
                    {isMaster ? (
                      <SessionSecretaryCell
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* 간사 관리 — 분과 목록 아래(관리자 전용): 간사 목록 + 생성 */}
      {isMaster && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              참여 간사 <span className="ml-0.5 text-xs text-slate-400">{secretaries.length}명</span>
            </h2>
            <div className="flex items-center gap-2">
              <ExcelExportButton href={`/api/projects/${id}/export/secretaries`} />
              <AddProjectSecretaryModal projectId={id} candidates={candidates} />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">이름</th>
                  <th className="px-5 py-2.5 font-medium">아이디</th>
                  <th className="px-5 py-2.5 font-medium">연락처</th>
                  <th className="px-5 py-2.5 font-medium">사번</th>
                  <th className="px-5 py-2.5 font-medium">담당 분과</th>
                  <th className="px-5 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {secretaries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                      참여 간사가 없습니다. 위의 '간사 추가'로 간사 풀에서 추가하세요.
                    </td>
                  </tr>
                )}
                {secretaries.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{u.name}</td>
                    <td className="px-5 py-2.5 text-slate-600">{u.username}</td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {u.phone ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {u.employeeNo ?? <span className="text-slate-300">—</span>}
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
                    <td className="px-5 py-2.5 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await removeSecretaryFromProject(id, u.id);
                        }}
                      >
                        <button className="text-sm whitespace-nowrap text-slate-500 hover:text-slate-700 hover:underline">제외</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 표 밑: 간사 비밀번호 조회·재발급 모달 */}
          <div className="flex justify-end">
            <UserPasswordManager
              roleLabel="간사"
              users={secretaries.map((u) => ({
                id: u.id,
                name: u.name,
                username: u.username,
                tempPassword: u.tempPassword,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
