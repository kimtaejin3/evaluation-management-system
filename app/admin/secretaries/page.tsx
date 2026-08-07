import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertMaster } from "@/lib/authz";
import UserManagerTable from "@/components/UserManagerTable";
import InfoIcon from "@/components/InfoIcon";
import ExcelExportButton from "@/components/ExcelExportButton";
import SecretaryImportButton from "@/components/SecretaryImportButton";
import { deleteSecretaries, updateUserInfo, resetUserPassword, setSecretarySessions } from "../actions";
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
  const [secretaries, sessions] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SECRETARY" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        tempPassword: true,
        assignedProjects: { select: { id: true, name: true }, orderBy: { createdAt: "desc" } },
        // 참여 중인 분과 — 본인이 담당(secretaryId)인 분과들(고아 분과 제외). 사업 1개라도 분과는 여러 개 가능.
        secretariedSessions: {
          where: { projectId: { not: null } },
          select: { id: true, name: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    // 배정 대상 분과 — 사업이 있는(고아 아님) 미마감 분과만.
    prisma.evaluationSession.findMany({
      where: { projectId: { not: null }, status: { not: "CLOSED" } },
      orderBy: [{ project: { createdAt: "desc" } }, { createdAt: "desc" }],
      select: { id: true, name: true, project: { select: { name: true } } },
    }),
  ]);

  const sessionOptions = sessions.map((s) => ({
    id: s.id,
    label: s.name,
    group: s.project?.name ?? "기타",
  }));

  const users = secretaries.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    phone: u.phone,
    tempPassword: u.tempPassword,
    chips: u.assignedProjects.map((p) => ({ label: p.name, href: `/admin/projects/${p.id}` })),
    chips2: u.secretariedSessions.map((s) => ({ label: s.name, href: `/admin/sessions/${s.id}` })),
    assignedSessionIds: u.secretariedSessions.map((s) => s.id),
  }));

  return (
    <UserManagerTable
      users={users}
      roleLabel="담당자"
      chipsHeader="참여 사업"
      chipsEmptyLabel="참여 없음"
      chips2Header="참여 중인 분과"
      chips2EmptyLabel="배정 없음"
      showPassword
      emptyLabel="등록된 담당자가 없습니다. 위의 ‘담당자 추가’로 시작하세요."
      deleteAction={deleteSecretaries}
      updateAction={updateUserInfo}
      resetPasswordAction={resetUserPassword}
      sessionOptions={sessionOptions}
      setSessionsAction={setSecretarySessions}
    />
  );
}
