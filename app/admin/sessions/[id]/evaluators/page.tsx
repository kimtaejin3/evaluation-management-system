import { Suspense } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  removeEvaluator,
  assignEvaluator,
  setChair,
} from "../../actions";
import { resetEvaluatorPassword } from "@/app/admin/actions";
import { requireAdminUser } from "@/lib/authz";
import { SkeletonCard, SkeletonTable } from "@/components/Skeletons";
import PasswordCell from "@/components/PasswordCell";
import ExcelExportButton from "@/components/ExcelExportButton";
import ExcelImportButton from "@/components/ExcelImportButton";
import EvaluatorReviewPanel, { type EvaluatorStatus } from "@/components/EvaluatorReviewPanel";

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
    prisma.assignment.findMany({
      where: { sessionId: id },
      include: { user: true },
    }),
  ]);
  const assignedIds = assignments.map((a) => a.userId);
  // 평가위원 관리에서 등록됐지만 이 분과에 아직 배정되지 않은 위원
  const available = await prisma.user.findMany({
    where: {
      role: "EVALUATOR",
      id: { notIn: assignedIds.length ? assignedIds : [""] },
    },
    orderBy: { name: "asc" },
  });
  const locked = session?.status === "CLOSED";
  const es = (session?.evaluatorStatus ?? "DRAFT") as EvaluatorStatus;
  // 담당자 제출(SUBMITTED) 이후에만 관리자가 배정을 볼 수 있다. 제출 전(DRAFT/REJECTED)은 '배정중'.
  const adminCanView = es === "SUBMITTED" || es === "APPROVED";
  // 배정 추가·해제·계정관리는 담당자만, 제출 전(DRAFT/REJECTED)에만. 관리자는 조회·승인만.
  const canEdit = !locked && !isMaster && (es === "DRAFT" || es === "REJECTED");
  // 관리자가 아직 배정을 볼 수 없는 상태(배정중/반려·미마감)
  const adminBlocked = isMaster && !locked && !adminCanView;
  // 위원장을 항상 리스트 맨 앞에
  const chairId = session?.chairId ?? null;
  const orderedAssignments = [...assignments].sort(
    (a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0),
  );
  const chairUser = assignments.find((a) => a.userId === chairId)?.user ?? null;
  // 위원장은 배정 승인 여부와 무관하게 배정된 위원 중에서 항시 지정할 수 있다.
  const chairCandidates = assignments.filter((a) => a.userId !== chairId);

  return (
    <div className="space-y-6">
      {/* 상단: 제목 + 엑셀 내보내기(역할·상태 무관 고정) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="text-sm font-semibold text-slate-700">
          평가위원 <span className="ml-0.5 text-xs text-slate-400">{assignments.length}명</span>
        </h2>
        <ExcelExportButton href={`/api/sessions/${id}/export/evaluators`} />
      </div>

      {/* 배정 검토 워크플로 배너 — 담당자: 제출/제출취소, 관리자: 승인/반려 */}
      {!locked && (
        <EvaluatorReviewPanel
          sessionId={id}
          isMaster={isMaster}
          status={es}
          rejectionReason={session?.evaluatorRejectionReason ?? null}
        />
      )}

      {/* 위원 배정 (상단) — 전역 등록된 위원을 드롭다운으로 선택해 배정만. 담당자·배정중에만 */}
      {locked ? (
        <p className="text-sm text-slate-400">
          마감된 분과는 평가위원을 수정할 수 없습니다.
        </p>
      ) : !canEdit ? null : (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-700">
              평가위원 배정
            </div>
            <ExcelImportButton scopeId={id} kind="evaluators" />
          </div>
          {/* 관리자가 전역으로 등록한 위원만 불러와 배정 */}
          <form action={assignEvaluator.bind(null, id)} className="flex gap-2">
            <select
              name="userId"
              defaultValue=""
              required
              className={`flex-1 ${inputCls}`}
            >
              <option value="" disabled>
                평가위원 선택 (평가위원 관리 등록자)
              </option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.username}
                </option>
              ))}
            </select>
            <button
              disabled={available.length === 0}
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              배정
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            위원 계정은{" "}
            <Link
              href="/admin/evaluators"
              className="text-indigo-600 hover:underline"
            >
              평가위원 관리
            </Link>
            에서 관리자가 전역으로 등록·관리합니다. 여기서는 등록된 위원을 이
            분과에 배정만 하며, 배정된 위원은 관리자 승인 후 평가에 참여할 수
            있습니다.
          </p>
        </div>
      )}

      {/* 위원장 지정 (담당자 전용) — 배정된 위원 중 1인. 검토 상태와 무관하게 항시 지정 가능 */}
      {!isMaster && assignments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-700">
            위원장 지정
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            위원장 1인 지정 시 총괄평가 작성 및 다른 위원의 점수 열람 권한이
            부여됩니다. 배정된 위원 중에서 언제든 지정·변경할 수 있습니다.
          </p>
          <div className="mt-3 text-sm text-slate-600">
            현재 위원장:{" "}
            {chairUser ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-medium text-slate-800">
                  {chairUser.name}
                </span>
                {!locked && (
                  <form
                    action={async () => {
                      "use server";
                      const fd = new FormData();
                      fd.set("userId", "");
                      await setChair(id, fd);
                    }}
                  >
                    <button className="text-xs text-slate-500 hover:underline">
                      해제
                    </button>
                  </form>
                )}
              </span>
            ) : (
              <span className="text-slate-400">미지정</span>
            )}
          </div>
          {!locked && (
            <form action={setChair.bind(null, id)} className="mt-3 flex gap-2">
              <select
                name="userId"
                defaultValue=""
                required
                className={`flex-1 ${inputCls}`}
              >
                <option value="" disabled>
                  위원장으로 지정할 위원 선택
                </option>
                {chairCandidates.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.user.name} · {a.user.username}
                  </option>
                ))}
              </select>
              <button
                disabled={chairCandidates.length === 0}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                지정
              </button>
            </form>
          )}
        </div>
      )}

      {/* 배정된 평가위원 — 관리자는 담당자 제출 후에만 조회 가능(배정중이면 숨김) */}
      {adminBlocked ? null : (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 font-semibold">
          <span>배정된 평가위원 ({assignments.length})</span>
        </div>
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">이름</th>
              <th className="px-5 py-3 font-medium">아이디</th>
              <th className="px-5 py-3 font-medium">연락처</th>
              <th className="px-5 py-3 font-medium">비밀번호</th>
              {canEdit && <th className="px-5 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {orderedAssignments.map((a) => {
              const isChair = session?.chairId === a.userId;
              return (
                <tr
                  key={a.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {a.user.name}
                    {isChair && (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        위원장
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {a.user.username}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {a.user.phone ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <PasswordCell value={a.user.tempPassword} />
                  </td>
                  {canEdit && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await resetEvaluatorPassword(a.userId);
                            revalidatePath(`/admin/sessions/${id}/evaluators`);
                          }}
                        >
                          <button className="text-sm text-slate-500 hover:text-indigo-600 hover:underline">
                            비번 재발급
                          </button>
                        </form>
                        <span className="text-slate-300" aria-hidden>/</span>
                        <form
                          action={async () => {
                            "use server";
                            await removeEvaluator(id, a.userId);
                          }}
                        >
                          <button className="text-sm text-slate-500 hover:text-amber-600 hover:underline">
                            배정 해제
                          </button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="px-5 py-10 text-center text-slate-400"
                >
                  배정된 위원이 없습니다. 위에서 평가위원을 선택해 배정하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
