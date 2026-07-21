import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertMaster } from "@/lib/authz";
import PasswordCell from "@/components/PasswordCell";
import InfoIcon from "@/components/InfoIcon";
import { deleteEvaluator, resetEvaluatorPassword } from "../actions";
import { SkeletonTable } from "@/components/Skeletons";

// 간사 관리(마스터) — 전역 간사 풀. 간사는 여러 과제에 참여할 수 있으며,
// 각 과제의 분과 목록에서는 이 풀에서 골라 참여 간사로 추가한다.
export default async function SecretariesAdminPage() {
  await assertMaster();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* 제목 옆에 설명을 정보 아이콘과 함께 인라인 배치 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h1 className="text-2xl font-bold">간사 관리</h1>
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <InfoIcon />
            간사 계정 풀을 관리합니다. 과제 참여는 각 과제의 분과 간사 설정에서 추가하세요.
          </span>
        </div>
        <Link
          href="/admin/secretaries/new"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
        >
          + 간사 추가
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

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="table-grid w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="px-4 py-2.5 font-medium">이름</th>
            <th className="px-4 py-2.5 font-medium">아이디</th>
            <th className="px-4 py-2.5 font-medium">연락처</th>
            <th className="px-4 py-2.5 font-medium">사번</th>
            <th className="px-4 py-2.5 font-medium">비밀번호</th>
            <th className="px-4 py-2.5 font-medium">참여 과제</th>
            <th className="px-4 py-2.5 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {secretaries.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                등록된 간사가 없습니다. 위의 &lsquo;간사 추가&rsquo;로 시작하세요.
              </td>
            </tr>
          )}
          {secretaries.map((u) => (
            <tr key={u.id} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
              <td className="px-4 py-2.5 text-slate-600">{u.username}</td>
              <td className="px-4 py-2.5 text-slate-600">{u.phone ?? <span className="text-slate-300">—</span>}</td>
              <td className="px-4 py-2.5 text-slate-600">{u.employeeNo ?? <span className="text-slate-300">—</span>}</td>
              <td className="px-4 py-2.5">
                <PasswordCell value={u.tempPassword} />
              </td>
              <td className="px-4 py-2.5">
                {u.assignedProjects.length === 0 ? (
                  <span className="text-xs text-slate-400">참여 없음</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {u.assignedProjects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/admin/projects/${p.id}`}
                        className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
                      >
                        {p.name}
                      </Link>
                    ))}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-3">
                  <form
                    action={async () => {
                      "use server";
                      await resetEvaluatorPassword(u.id);
                    }}
                  >
                    <button className="text-sm whitespace-nowrap text-slate-500 hover:text-indigo-600 hover:underline">
                      비번 재발급
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await deleteEvaluator(u.id);
                    }}
                  >
                    <button className="text-sm whitespace-nowrap text-slate-500 hover:text-slate-700 hover:underline">
                      삭제
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
