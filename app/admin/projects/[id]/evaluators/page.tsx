import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import ReviewStatusBadge, { ApprovalBadge } from "@/components/ReviewStatusBadge";
import ReviewDecisionButtons from "@/components/ReviewDecisionButtons";
import PasswordCell from "@/components/PasswordCell";
import ExcelExportButton from "@/components/ExcelExportButton";
import { SkeletonTable } from "@/components/Skeletons";

// 과제 평가위원 선정현황 — 분과별 위원 배정을 테이블 뷰로 한눈에.
// 배정·위원장 지정·승인/반려 등 상세 작업은 분과의 평가 위원 페이지에서 한다.
export default async function ProjectEvaluatorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 제목·설명은 정적이므로 Suspense 밖에서 즉시 렌더 — 로딩 중에도 보인다.
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href={`/admin/projects/${id}`} className="text-sm text-slate-400 hover:text-slate-600">
            ← 분과 목록
          </Link>
          <h1 className="mt-1 text-2xl font-bold">평가위원 선정현황</h1>
          <p className="mt-1 text-sm text-slate-500">
            분과별 위원 배정 현황입니다. 배정·승인/반려는 분과 페이지에서 진행합니다.
          </p>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/evaluators`} />
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={5} />}>
        <Content id={id} />
      </Suspense>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  const { user } = await assertProjectAccess(id);
  const isMaster = user.role === "MASTER";
  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      chairId: true,
      evaluatorStatus: true,
      secretary: { select: { name: true } },
      assignments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          userId: true,
          user: { select: { name: true, username: true, phone: true, tempPassword: true } },
        },
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">간사 제출</th>
                <th className="px-5 py-3 font-medium">위원명</th>
                <th className="px-5 py-3 font-medium">아이디</th>
                <th className="px-5 py-3 font-medium">비밀번호</th>
                <th className="px-5 py-3 font-medium">연락처</th>
                <th className="px-5 py-3 font-medium">승인 상태</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                // 분과 페이지와 동일 규칙 — 간사 제출(SUBMITTED/APPROVED) 전에는 관리자가
                // 배정 위원 명단을 볼 수 없다(마감된 분과는 예외적으로 공개).
                const adminBlocked =
                  isMaster &&
                  s.status !== "CLOSED" &&
                  s.evaluatorStatus !== "SUBMITTED" &&
                  s.evaluatorStatus !== "APPROVED";
                const rows = adminBlocked ? 1 : s.assignments.length || 1;
                // 마지막 컬럼(분과 단위) — 승인 상태(배지·관리자 버튼)
                const tail = (
                  <td rowSpan={rows} className="border-l border-slate-100 px-5 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ApprovalBadge status={s.evaluatorStatus} />
                      {isMaster && (
                        <ReviewDecisionButtons sessionId={s.id} status={s.evaluatorStatus} kind="evaluators" />
                      )}
                    </div>
                  </td>
                );
                const head = (
                  <>
                    <td rowSpan={rows} className="border-r border-slate-100 px-5 py-3 align-top">
                      <Link
                        href={`/admin/sessions/${s.id}/evaluators`}
                        className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                      >
                        {s.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-400">{s.secretary?.name ?? "간사 미배정"}</div>
                    </td>
                    <td rowSpan={rows} className="border-r border-slate-100 px-5 py-3 align-top">
                      <ReviewStatusBadge status={s.evaluatorStatus} />
                    </td>
                  </>
                );
                if (adminBlocked) {
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      {head}
                      <td colSpan={4} className="px-5 py-3 text-sm text-slate-400">
                        간사 제출 전에는 배정 위원이 표시되지 않습니다.
                      </td>
                      {tail}
                    </tr>
                  );
                }
                if (s.assignments.length === 0) {
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      {head}
                      <td colSpan={4} className="px-5 py-3 text-sm text-slate-400">
                        배정된 위원 없음
                      </td>
                      {tail}
                    </tr>
                  );
                }
                return s.assignments.map((a, i) => {
                  return (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0">
                      {i === 0 && head}
                      <td className="px-5 py-3 text-slate-800">
                        {a.user.name}
                        {a.userId === s.chairId && (
                          <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                            위원장
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.user.username}</td>
                      <td className="px-5 py-3">
                        <PasswordCell value={a.user.tempPassword} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.user.phone ?? "—"}</td>
                      {i === 0 && tail}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
    </div>
  );
}
