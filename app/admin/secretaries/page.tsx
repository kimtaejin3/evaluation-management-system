import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertMaster } from "@/lib/authz";
import UserManagerTable from "@/components/UserManagerTable";
import InfoIcon from "@/components/InfoIcon";
import { deleteSecretaries } from "../actions";
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
            담당자 계정 풀을 관리합니다. 사업 참여는 각 사업의 사업 담당자 설정에서 추가하세요.
          </span>
        </div>
        <Link
          href="/admin/secretaries/new"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
        >
          + 담당자 추가
        </Link>
      </div>

      <Suspense fallback={<SkeletonTable rows={5} cols={6} />}>
        <SecretaryTable />
      </Suspense>
    </div>
  );
}

async function SecretaryTable() {
  const secretaries = await prisma.user.findMany({
    where: { role: "SECRETARY" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      phone: true,
      employeeNo: true,
      tempPassword: true,
      assignedProjects: { select: { id: true, name: true }, orderBy: { createdAt: "desc" } },
    },
  });

  const users = secretaries.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    phone: u.phone,
    employeeNo: u.employeeNo,
    tempPassword: u.tempPassword,
    chips: u.assignedProjects.map((p) => ({ label: p.name, href: `/admin/projects/${p.id}` })),
  }));

  return (
    <UserManagerTable
      users={users}
      roleLabel="담당자"
      chipsHeader="참여 사업"
      chipsEmptyLabel="참여 없음"
      showEmployeeNo
      emptyLabel="등록된 담당자가 없습니다. 위의 ‘담당자 추가’로 시작하세요."
      deleteAction={deleteSecretaries}
    />
  );
}
