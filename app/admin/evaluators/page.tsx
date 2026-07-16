import { Suspense } from "react";
import { prisma } from "@/lib/db";
import PasswordCell from "@/components/PasswordCell";
import Link from "next/link";
import { deleteEvaluator, resetEvaluatorPassword } from "../actions";
import { assertMaster } from "@/lib/authz";
import { SkeletonTable } from "@/components/Skeletons";

export default async function EvaluatorsAdminPage() {
  await assertMaster();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">평가위원 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            평가위원 계정을 등록·관리합니다. 분과 배정은 분과별 화면에서, 간사 관리는 간사 관리 페이지에서 진행하세요.
          </p>
        </div>
        <Link
          href="/admin/evaluators/new"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition hover:bg-indigo-700"
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

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">아이디</th>
              <th className="px-4 py-2.5 font-medium">연락처</th>
              <th className="px-4 py-2.5 font-medium">비밀번호</th>
              <th className="px-4 py-2.5 font-medium">배정 분과</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {evaluators.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="font-medium text-slate-800">{u.name}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{u.username}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.phone ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5">
                  <PasswordCell value={u.tempPassword} />
                </td>
                <td className="px-4 py-2.5">
                  {u.assignments.length === 0 ? (
                    <span className="text-xs text-slate-400">배정 없음</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {u.assignments.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {a.session.name}
                        </span>
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
                      <button className="text-sm text-slate-500 hover:text-indigo-600 hover:underline">
                        비번 재발급
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deleteEvaluator(u.id);
                      }}
                    >
                      <button className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
                        삭제
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {evaluators.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  등록된 평가위원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
    </div>
  );
}
