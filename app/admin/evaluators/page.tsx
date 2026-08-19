import { Suspense } from "react";
import { prisma } from "@/lib/db";
import InfoIcon from "@/components/InfoIcon";
import Link from "next/link";
import UserManagerTable from "@/components/UserManagerTable";
import ExcelExportButton from "@/components/ExcelExportButton";
import EvaluatorAccountImportButton from "@/components/EvaluatorAccountImportButton";
import { deleteEvaluators, updateUserInfo, resetUserPassword, setEvaluatorSessions, setEvaluatorProjects } from "../actions";
import { assertMaster } from "@/lib/authz";
import { SkeletonTable } from "@/components/Skeletons";

export default async function EvaluatorsAdminPage() {
  await assertMaster();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* 제목 옆에 설명을 정보 아이콘과 함께 인라인 배치 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h1 className="text-2xl font-bold">평가위원 관리</h1>
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <InfoIcon />
            평가위원 계정을 등록·관리하고, 선택한 위원을 분과에 배정합니다. 위원장 지정은 담당자가 분과별 화면에서 진행합니다.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 엑셀 양식(테이블에 맞춘 머리글) + 엑셀 업로드(일괄 등록) + 단건 추가 */}
          <ExcelExportButton href="/api/evaluators-template" label="양식 다운로드" />
          <EvaluatorAccountImportButton />
          <Link
            href="/admin/evaluators/new"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
          >
            + 평가위원 추가
          </Link>
        </div>
      </div>

      <Suspense fallback={<SkeletonTable rows={5} cols={5} />}>
        <EvaluatorTable />
      </Suspense>

    </div>
  );
}

async function EvaluatorTable() {
  const [evaluators, sessions, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: "EVALUATOR" },
      orderBy: { createdAt: "asc" },
      include: {
        // 참여 사업 — 분과 배정과 별개로 저장되는 관계
        evaluatingProjects: { select: { id: true, name: true, startDate: true, endDate: true }, orderBy: { createdAt: "desc" } },
        assignments: {
          // 사업이 삭제된 고아 분과(projectId=null)는 배정 칩에서 제외 — 삭제한 분과가 계속 뜨는 문제 방지.
          where: { session: { projectId: { not: null } } },
          include: {
            session: {
              select: {
                id: true,
                name: true,
                status: true,
                endDate: true,
                project: { select: { name: true, endDate: true } },
              },
            },
          },
          orderBy: { session: { createdAt: "desc" } },
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
  const users = evaluators.map((u) => {
    // (사업, 분과) 짝 행 — 배정 분과는 소속 사업과 짝으로, 배정 없는 참여 사업은 분과 없이 한 줄.
    const pairs: { project: string | null; session: string | null; progress: "BEFORE" | "ONGOING" | "DONE" }[] = u.assignments.map((a) => ({
      project: a.session.project?.name ?? null,
      session: a.session.name,
      progress: sessionProgress(a.session),
    }));
    const assignedProjectNames = new Set(pairs.map((p) => p.project));
    for (const p of u.evaluatingProjects) {
      if (!assignedProjectNames.has(p.name)) pairs.push({ project: p.name, session: null, progress: projectProgress(p) });
    }
    pairs.sort((a, b) => (a.project ?? '').localeCompare(b.project ?? '', 'ko') || (a.session ?? '').localeCompare(b.session ?? '', 'ko'));
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      phone: u.phone,
      affiliation: u.affiliation,
      position: u.position,
      tempPassword: u.tempPassword,
      chips: u.evaluatingProjects.map((p) => ({ label: p.name })),
      chips2: u.assignments.map((a) => ({ label: a.session.name })),
      assignedSessionIds: u.assignments.map((a) => a.session.id),
      assignedProjectIds: u.evaluatingProjects.map((p) => p.id),
      pairs,
    };
  });

  return (
    <UserManagerTable
      users={users}
      roleLabel="위원"
      chipsHeader="참여 사업"
      chipsEmptyLabel="참여 없음"
      chips2Header="배정 분과"
      chips2EmptyLabel="미정"
      emptyLabel="등록된 평가위원이 없습니다."
      pairMode
      deleteAction={deleteEvaluators}
      updateAction={updateUserInfo}
      resetPasswordAction={resetUserPassword}
      showAffiliation
      sessionOptions={sessionOptions}
      setSessionsAction={setEvaluatorSessions}
      projectOptions={projectOptions}
      setProjectsAction={setEvaluatorProjects}
    />
  );
}
