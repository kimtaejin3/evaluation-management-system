import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import PasswordCell from "@/components/PasswordCell";
import ExcelExportButton from "@/components/ExcelExportButton";
import { SkeletonTable } from "@/components/Skeletons";

// 사업 평가위원 선정현황 — 분과별 위원 배정을 테이블 뷰로 한눈에(조회 전용).
// 담당자가 세팅한 배정을 관리자가 확인하는 용도. 배정·위원장 지정은 분과의 평가 위원 페이지에서 한다.
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
          <h1 className="mt-1 text-2xl font-bold">평가위원 선정현황</h1>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/evaluators`} />
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={5} />}>
        <Content id={id} />
      </Suspense>
      <p className="text-left text-xs text-slate-400">
        분과별 위원 배정 현황입니다. 배정·위원장 지정은 분과 페이지에서 진행합니다.
      </p>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  await assertProjectAccess(id);
  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      chairId: true,
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
    <div className="space-y-2">
      {/* 범례 — 위원장 행 배경색 안내 */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 rounded-sm border border-indigo-200 bg-indigo-50/70" aria-hidden />
          위원장
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">위원명</th>
                <th className="px-5 py-3 font-medium">아이디</th>
                <th className="px-5 py-3 font-medium">비밀번호</th>
                <th className="px-5 py-3 font-medium">연락처</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const rows = s.assignments.length || 1;
                const head = (
                  <td rowSpan={rows} className="border-r border-slate-100 px-5 py-3 align-top">
                    <Link
                      href={`/admin/sessions/${s.id}/evaluators`}
                      className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                );
                if (s.assignments.length === 0) {
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      {head}
                      <td colSpan={4} className="px-5 py-3 text-sm text-slate-400">
                        배정된 위원 없음
                      </td>
                    </tr>
                  );
                }
                return s.assignments.map((a, i) => {
                  const isChair = a.userId === s.chairId;
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-slate-50 last:border-0 ${isChair ? "bg-indigo-50/70" : ""}`}
                      title={isChair ? "위원장" : undefined}
                    >
                      {i === 0 && head}
                      <td className={`px-5 py-3 ${isChair ? "font-semibold text-slate-900" : "text-slate-800"}`}>
                        {a.user.name}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.user.username}</td>
                      <td className="px-5 py-3">
                        <PasswordCell value={a.user.tempPassword} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.user.phone ?? "—"}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
