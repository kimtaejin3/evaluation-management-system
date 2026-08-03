import { Suspense } from "react";
import { prisma } from "@/lib/db";
import InfoIcon from "@/components/InfoIcon";
import Link from "next/link";
import UserManagerTable from "@/components/UserManagerTable";
import { deleteEvaluators } from "../actions";
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
            평가위원 계정을 등록·관리합니다. 분과 배정은 분과별 화면에서, 담당자 관리는 담당자 관리 페이지에서 진행하세요.
          </span>
        </div>
        <Link
          href="/admin/evaluators/new"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
        >
          + 평가위원 추가
        </Link>
      </div>

      <Suspense fallback={<SkeletonTable rows={5} cols={5} />}>
        <EvaluatorTable />
      </Suspense>

    </div>
  );
}

async function EvaluatorTable() {
  const evaluators = await prisma.user.findMany({
    where: { role: "EVALUATOR" },
    orderBy: { createdAt: "asc" },
    include: {
      assignments: {
        include: {
          session: { select: { id: true, name: true, status: true } },
        },
        orderBy: { session: { createdAt: "desc" } },
      },
    },
  });

  const users = evaluators.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    phone: u.phone,
    employeeNo: u.employeeNo,
    tempPassword: u.tempPassword,
    chips: u.assignments.map((a) => ({ label: a.session.name })),
  }));

  return (
    <UserManagerTable
      users={users}
      roleLabel="위원"
      chipsHeader="배정 분과"
      chipsEmptyLabel="배정 없음"
      emptyLabel="등록된 평가위원이 없습니다."
      deleteAction={deleteEvaluators}
    />
  );
}
