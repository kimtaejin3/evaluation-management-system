import Link from "next/link";
import { prisma } from "@/lib/db";
import { addEvaluator, removeEvaluator, assignEvaluator, setChair } from "../../actions";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default async function EvaluatorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.evaluationSession.findUnique({ where: { id } });
  const assignments = await prisma.assignment.findMany({
    where: { sessionId: id },
    include: { user: true },
  });
  const assignedIds = assignments.map((a) => a.userId);
  // 평가위원 관리에서 등록됐지만 이 심사에 아직 배정되지 않은 위원
  const available = await prisma.user.findMany({
    where: { role: "EVALUATOR", id: { notIn: assignedIds.length ? assignedIds : [""] } },
    orderBy: { name: "asc" },
  });
  const locked = session?.status === "CLOSED";

  return (
    <div className="space-y-6">
      {/* 위원 추가 (상단) */}
      {locked ? (
        <p className="text-sm text-slate-400">마감된 심사는 평가위원을 수정할 수 없습니다.</p>
      ) : (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 text-sm font-semibold text-slate-700">평가위원 배정</div>
          {/* 기존 위원 불러오기 */}
          <form action={assignEvaluator.bind(null, id)} className="flex gap-2">
            <select name="userId" defaultValue="" required className={`flex-1 ${inputCls}`}>
              <option value="" disabled>평가위원 선택 (평가위원 관리 등록자)</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.username}</option>
              ))}
            </select>
            <button disabled={available.length === 0} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
              배정
            </button>
          </form>
          {/* 신규 위원 등록·배정 */}
          <form action={addEvaluator.bind(null, id)} className="flex flex-wrap gap-2">
            <input name="name" placeholder="이름" required className={`w-24 ${inputCls}`} />
            <input name="username" placeholder="아이디" required className={`w-28 ${inputCls}`} />
            <input name="password" placeholder="임시 비번" required className={`w-24 ${inputCls}`} />
            <button className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
              등록·배정
            </button>
          </form>
          <p className="sm:col-span-2 text-xs text-slate-400">
            위원 계정은 <Link href="/admin/evaluators" className="text-indigo-600 hover:underline">평가위원 관리</Link>에서 전역으로 등록·관리됩니다. 여기서는 이 심사에 배정만 합니다.
          </p>
        </div>
      )}

      {/* 배정된 평가위원 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">
          배정된 평가위원 ({assignments.length})
          <span className="ml-2 text-xs font-normal text-slate-400">· 위원장 1인 지정 시 총괄평가/타 위원 점수 열람 권한 부여</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">이름</th>
              <th className="px-5 py-3 font-medium">아이디</th>
              <th className="px-5 py-3 font-medium">위원장</th>
              {!locked && <th className="px-5 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const isChair = session?.chairId === a.userId;
              return (
                <tr key={a.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {a.user.name}
                    {isChair && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">위원장</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{a.user.username}</td>
                  <td className="px-5 py-3">
                    {locked ? (
                      isChair ? "위원장" : "—"
                    ) : isChair ? (
                      <form action={async () => { "use server"; const fd = new FormData(); fd.set("userId", ""); await setChair(id, fd); }}>
                        <button className="text-xs text-slate-500 hover:underline">위원장 해제</button>
                      </form>
                    ) : (
                      <form action={async () => { "use server"; const fd = new FormData(); fd.set("userId", a.userId); await setChair(id, fd); }}>
                        <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50">위원장 지정</button>
                      </form>
                    )}
                  </td>
                  {!locked && (
                    <td className="px-5 py-3 text-right">
                      <form action={async () => { "use server"; await removeEvaluator(id, a.userId); }}>
                        <button className="text-sm text-rose-600 hover:underline">배정 해제</button>
                      </form>
                    </td>
                  )}
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={locked ? 3 : 4} className="px-5 py-10 text-center text-slate-400">
                  배정된 위원이 없습니다. 위에서 평가위원을 선택해 배정하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
