import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertMaster } from "@/lib/authz";
import UserManagerTable from "@/components/UserManagerTable";
import InfoIcon from "@/components/InfoIcon";
import ExcelExportButton from "@/components/ExcelExportButton";
import SecretaryImportButton from "@/components/SecretaryImportButton";
import { deleteSecretaries, updateUserInfo, resetUserPassword, setSecretarySessions, setSecretaryProjects } from "../actions";
import { SkeletonTable } from "@/components/Skeletons";

// 담당자 관리(마스터) — 전역 담당자 풀. 담당자는 여러 사업에 참여할 수 있으며,
// 각 사업의 분과 목록에서는 이 풀에서 골라 참여 담당자로 추가한다.
export default async function SecretariesAdminPage() {
  await assertMaster();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* 제목 옆에 설명을 정보 아이콘과 함께 인라인 배치 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h1 className="text-2xl font-bold">담당자 관리</h1>
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <InfoIcon />
            담당자 계정 풀을 관리하고, 담당자를 선택해 분과에 배정합니다(분과당 1명).
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 엑셀 양식(현재 테이블에 맞춘 머리글) + 엑셀 업로드(일괄 등록) + 단건 추가 */}
          <ExcelExportButton href="/api/secretaries-template" label="양식 다운로드" />
          <SecretaryImportButton />
          <Link
            href="/admin/secretaries/new"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
          >
            + 담당자 추가
          </Link>
        </div>
      </div>

      <Suspense fallback={<SkeletonTable rows={5} cols={6} />}>
        <SecretaryTable />
      </Suspense>
    </div>
  );
}

async function SecretaryTable() {
  const [secretaries, sessions, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SECRETARY" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        tempPassword: true,
        assignedProjects: { select: { id: true, name: true, startDate: true, endDate: true }, orderBy: { createdAt: "desc" } },
        // 참여 중인 분과 — 본인이 담당(secretaryId)인 분과들(고아 분과 제외). 사업 1개라도 분과는 여러 개 가능.
        secretariedSessions: {
          where: { projectId: { not: null } },
          select: { id: true, name: true, status: true, endDate: true, project: { select: { name: true, endDate: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    // 배정 대상 분과 — 사업이 있는(고아 아님) 분과. 종료된 분과도 상태 컬럼으로 구분해 보여준다.
    prisma.evaluationSession.findMany({
      where: { projectId: { not: null } },
      orderBy: [{ project: { createdAt: "desc" } }, { createdAt: "desc" }],
      select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
    }),
    // 사업 목록 — '사업 설정'용
    prisma.project.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
  ]);

  const sessionOptions = sessions.map((s) => ({
    id: s.id,
    label: s.name,
    group: s.project?.name ?? "기타",
    projectId: s.projectId ?? undefined,
  }));
  const projectOptions = projects.map((p) => ({ id: p.id, label: p.name }));

  // 평가 진행 상황 — 완료: 마감(CLOSED)·종료일 경과 / 시작 전: 초안(DRAFT)·시작일 도래 전 / 그 외 진행중.
  const now = new Date();
  const ended = (d: Date | null) => !!d && d < now;
  const sessionProgress = (s: { status: string; endDate: Date | null; project: { endDate: Date | null } | null }) =>
    s.status === "CLOSED" || ended(s.endDate) || ended(s.project?.endDate ?? null)
      ? ("DONE" as const)
      : s.status === "DRAFT"
        ? ("BEFORE" as const)
        : ("ONGOING" as const);
  const projectProgress = (p: { startDate?: Date | null; endDate: Date | null }) =>
    ended(p.endDate) ? ("DONE" as const) : p.startDate && p.startDate > now ? ("BEFORE" as const) : ("ONGOING" as const);
  const users = secretaries.map((u) => {
    // (사업, 분과) 짝 행 — 담당 분과는 소속 사업과 짝으로, 담당 분과 없는 참여 사업은 분과 없이 한 줄.
    const projectIdByName = new Map(projects.map((p) => [p.name, p.id]));
    const pairs: {
      project: string | null;
      projectId: string | null;
      session: string | null;
      sessionId: string | null;
      progress: "BEFORE" | "ONGOING" | "DONE";
    }[] = u.secretariedSessions.map((s) => ({
      project: s.project?.name ?? null,
      projectId: s.project?.name ? (projectIdByName.get(s.project.name) ?? null) : null,
      session: s.name,
      sessionId: s.id,
      progress: sessionProgress(s),
    }));
    const pairProjectNames = new Set(pairs.map((p) => p.project));
    for (const p of u.assignedProjects) {
      if (!pairProjectNames.has(p.name))
        pairs.push({ project: p.name, projectId: p.id, session: null, sessionId: null, progress: projectProgress(p) });
    }
    pairs.sort((a, b) => (a.project ?? "").localeCompare(b.project ?? "", "ko") || (a.session ?? "").localeCompare(b.session ?? "", "ko"));
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      phone: u.phone,
      tempPassword: u.tempPassword,
      chips: u.assignedProjects.map((p) => ({ label: p.name, href: `/admin/projects/${p.id}` })),
      chips2: u.secretariedSessions.map((s) => ({ label: s.name, href: `/admin/sessions/${s.id}` })),
      assignedSessionIds: u.secretariedSessions.map((s) => s.id),
      assignedProjectIds: u.assignedProjects.map((p) => p.id),
      pairs,
    };
  });

  return (
    <UserManagerTable
      users={users}
      roleLabel="담당자"
      chipsHeader="참여 사업"
      chipsEmptyLabel="참여 없음"
      chips2Header="참여 중인 분과"
      chips2EmptyLabel="배정 없음"
      showPassword
      pairMode
      emptyLabel="등록된 담당자가 없습니다. 위의 ‘담당자 추가’로 시작하세요."
      deleteAction={deleteSecretaries}
      updateAction={updateUserInfo}
      resetPasswordAction={resetUserPassword}
      sessionOptions={sessionOptions}
      setSessionsAction={setSecretarySessions}
      projectOptions={projectOptions}
      setProjectsAction={setSecretaryProjects}
    />
  );
}
