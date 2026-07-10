import { Suspense } from "react";
import { prisma } from "@/lib/db";
import PasswordCell from "@/components/PasswordCell";
import { createEvaluator, deleteEvaluator, resetEvaluatorPassword } from "../actions";
import { assertMaster } from "@/lib/authz";
import { SkeletonTable } from "@/components/Skeletons";

const inputCls =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default async function EvaluatorsAdminPage() {
  await assertMaster();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">평가위원·간사 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          계정을 등록·관리합니다. 분과 배정은 분과별 화면에서 진행하세요.
        </p>
      </div>

      <Suspense fallback={<SkeletonTable rows={5} cols={5} />}>
        <EvaluatorTable />
      </Suspense>

      <form
        action={createEvaluator}
        className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="col-span-2 text-sm font-semibold text-slate-700">
          계정 추가 (평가위원 / 간사)
        </div>
        <input name="name" placeholder="이름" required className={inputCls} />
        <input
          name="username"
          placeholder="아이디"
          required
          className={inputCls}
        />
        <input
          name="phone"
          placeholder="연락처 (예: 010-1234-5678)"
          required
          className={`col-span-2 ${inputCls}`}
        />
        <select name="role" defaultValue="EVALUATOR" className={`col-span-2 ${inputCls}`}>
          <option value="EVALUATOR">평가위원</option>
          <option value="SECRETARY">간사</option>
        </select>
        <button className="col-span-2 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          + 계정 추가
        </button>
        <p className="col-span-2 text-xs text-slate-400">
          비밀번호는 연락처 끝 4자리로 발급됩니다. 기존 아이디면 이름·연락처·역할을 갱신합니다.
        </p>
      </form>
    </div>
  );
}

async function EvaluatorTable() {
  const evaluators = await prisma.user.findMany({
    where: { role: { in: ["EVALUATOR", "SECRETARY"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
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
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">역할</th>
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
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${u.role === "SECRETARY" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                    {u.role === "SECRETARY" ? "간사" : "평가위원"}
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
                      <button className="text-sm text-rose-600 hover:underline">
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
                  colSpan={7}
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
