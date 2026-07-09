import { Suspense } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  removeEvaluator,
  assignEvaluator,
  setChair,
  createEvaluatorForSession,
  approveAssignment,
  rejectAssignment,
  approveAllAssignments,
} from "../../actions";
import { resetEvaluatorPassword, deleteEvaluator } from "@/app/admin/actions";
import { assignmentStatusLabel, type AssignmentStatus } from "@/lib/assignment";
import { requireAdminUser } from "@/lib/authz";
import { SkeletonCard, SkeletonTable } from "@/components/Skeletons";
import EvaluatorImportButton from "@/components/EvaluatorImportButton";
import PasswordCell from "@/components/PasswordCell";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default async function EvaluatorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonCard lines={2} />
          <SkeletonTable rows={4} cols={4} />
        </div>
      }
    >
      <EvaluatorsContent id={id} />
    </Suspense>
  );
}

async function EvaluatorsContent({ id }: { id: string }) {
  const me = await requireAdminUser();
  const isMaster = me.role === "MASTER";
  const [session, assignments] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: true } }),
  ]);
  const assignedIds = assignments.map((a) => a.userId);
  // 평가위원 관리에서 등록됐지만 이 분과에 아직 배정되지 않은 위원
  const available = await prisma.user.findMany({
    where: { role: "EVALUATOR", id: { notIn: assignedIds.length ? assignedIds : [""] } },
    orderBy: { name: "asc" },
  });
  const locked = session?.status === "CLOSED";
  // 위원장을 항상 리스트 맨 앞에
  const chairId = session?.chairId ?? null;
  const orderedAssignments = [...assignments].sort(
    (a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0),
  );
  const pendingCount = assignments.filter((a) => a.status === "PENDING").length;
  const badgeCls: Record<AssignmentStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="space-y-6">
      {/* 위원 추가 (상단) */}
      {locked ? (
        <p className="text-sm text-slate-400">마감된 분과는 평가위원을 수정할 수 없습니다.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">평가위원 배정</div>
            <EvaluatorImportButton sessionId={id} />
          </div>
          {/* 기존 위원 불러오기 */}
          <form action={assignEvaluator.bind(null, id)} className="flex gap-2">
            <select name="userId" defaultValue="" required className={`flex-1 ${inputCls}`}>
              <option value="" disabled>평가위원 선택 (평가위원 관리 등록자)</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.username}</option>
              ))}
            </select>
            <button disabled={available.length === 0} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
              배정
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            위원 계정은 <Link href="/admin/evaluators" className="text-indigo-600 hover:underline">평가위원 관리</Link>에서 전역으로 등록·관리됩니다. 여기서는 이 분과에 배정만 합니다.
          </p>
          {/* 신규 위원 생성(이 분과 전용) */}
          <form action={createEvaluatorForSession.bind(null, id)} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <input name="name" required placeholder="새 위원 이름" className={`flex-1 ${inputCls}`} />
            <input name="phone" required placeholder="연락처(임시비번=끝 4자리)" className={`flex-1 ${inputCls}`} />
            <button className="shrink-0 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50">
              신규 등록
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-400">
            {isMaster ? "관리자가 등록하면 즉시 승인됩니다." : "간사가 등록한 위원은 관리자 승인 후 평가에 참여할 수 있습니다."}
          </p>
        </div>
      )}

      {/* 배정된 평가위원 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 font-semibold">
          <span>
            배정된 평가위원 ({assignments.length})
            <span className="ml-2 text-xs font-normal text-slate-400">· 위원장 1인 지정 시 총괄평가/타 위원 점수 열람 권한 부여</span>
            {pendingCount > 0 && <span className="ml-2 text-xs font-normal text-amber-600">· 승인 대기 {pendingCount}</span>}
          </span>
          {isMaster && pendingCount > 0 && (
            <form action={approveAllAssignments.bind(null, id)}>
              <button className="rounded-md bg-[var(--gov-navy)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90">전체 승인</button>
            </form>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">이름</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="px-5 py-3 font-medium">아이디</th>
              <th className="px-5 py-3 font-medium">연락처</th>
              <th className="px-5 py-3 font-medium">비밀번호</th>
              <th className="px-5 py-3 font-medium">위원장</th>
              {!locked && <th className="px-5 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {orderedAssignments.map((a) => {
              const isChair = session?.chairId === a.userId;
              return (
                <tr key={a.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {a.user.name}
                    {isChair && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">위원장</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls[a.status as AssignmentStatus]}`}>
                      {assignmentStatusLabel(a.status as AssignmentStatus)}
                    </span>
                    {isMaster && a.status !== "APPROVED" && (
                      <form action={approveAssignment.bind(null, id, a.userId)} className="mt-1 inline-block">
                        <button className="text-xs text-emerald-700 hover:underline">승인</button>
                      </form>
                    )}
                    {isMaster && a.status !== "REJECTED" && (
                      <form action={rejectAssignment.bind(null, id, a.userId)} className="ml-2 mt-1 inline-block">
                        <button className="text-xs text-rose-600 hover:underline">비승인</button>
                      </form>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{a.user.username}</td>
                  <td className="px-5 py-3 text-slate-600">{a.user.phone ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3">
                    <PasswordCell value={a.user.tempPassword} />
                  </td>
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
                      <div className="flex items-center justify-end gap-3">
                        <form action={async () => { "use server"; await resetEvaluatorPassword(a.userId); revalidatePath(`/admin/sessions/${id}/evaluators`); }}>
                          <button className="text-sm text-slate-500 hover:text-indigo-600 hover:underline">비번 재발급</button>
                        </form>
                        <form action={async () => { "use server"; await removeEvaluator(id, a.userId); }}>
                          <button className="text-sm text-slate-500 hover:text-amber-600 hover:underline">배정 해제</button>
                        </form>
                        <form action={async () => { "use server"; await deleteEvaluator(a.userId); revalidatePath(`/admin/sessions/${id}/evaluators`); }}>
                          <button className="text-sm text-rose-600 hover:underline">계정 삭제</button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={locked ? 6 : 7} className="px-5 py-10 text-center text-slate-400">
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
