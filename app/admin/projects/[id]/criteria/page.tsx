import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import ExcelExportButton from "@/components/ExcelExportButton";
import ExcelImportButton from "@/components/ExcelImportButton";
import CriteriaPrintButton from "@/components/CriteriaPrintButton";
import CriteriaEditor from "@/components/CriteriaEditor";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";
import { SkeletonTable } from "@/components/Skeletons";

// 사업 공통 평가항목 — 사업의 모든 분과가 같은 항목을 쓴다.
// 관리자가 여기서 작성·수정하고, 각 분과 담당자는 분과 화면에서 조회 후 '확인'한다.
export default async function ProjectCriteriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 제목·설명은 정적이므로 Suspense 밖에서 즉시 렌더 — 로딩 중에도 보인다.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-1 text-2xl font-bold">평가항목</h1>
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={4} />}>
        <Content id={id} />
      </Suspense>
      <p className="text-left text-xs text-slate-400">
        사업 공통 평가항목입니다. 소속 분과 전체에 동일하게 적용됩니다.
      </p>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  const { user, project } = await assertProjectAccess(id);
  const isMaster = user.role === "MASTER";

  const [groups, sessions] = await Promise.all([
    prisma.criterionGroup.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
      include: {
        subitems: {
          orderBy: { order: "asc" },
          include: {
            criteria: {
              orderBy: { order: "asc" },
              select: { id: true, name: true, maxScore: true },
            },
          },
        },
      },
    }),
    prisma.evaluationSession.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        criteriaAckAt: true,
        secretary: { select: { name: true } },
      },
    }),
  ]);

  const totalAll = groups.reduce(
    (s, g) => s + g.subitems.reduce((s2, sub) => s2 + sub.criteria.reduce((s3, c) => s3 + c.maxScore, 0), 0),
    0,
  );
  const ackedCount = sessions.filter((s) => s.criteriaAckAt).length;

  return (
    <div className="space-y-6">
      {/* 도구 모음 — 배점 요약·가져오기·인쇄·내보내기 (데이터 의존이라 Suspense 안) */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-slate-400">
          배점 합계 {totalAll}점 · 기준 만점 {project.maxScore}점
        </span>
        {isMaster && <ExcelExportButton href="/api/criteria-template" label="양식 다운로드" />}
        {isMaster && <ExcelImportButton scopeId={id} kind="criteria" />}
        <ExcelExportButton href={`/api/projects/${id}/export/criteria`} />
        <CriteriaPrintButton projectId={id} />
      </div>

      {/* 항목 편집(관리자) / 조회(담당자) */}
      {isMaster ? (
        <CriteriaEditor projectId={id} groups={groups} maxScore={project.maxScore} />
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
          아직 등록된 평가항목이 없습니다.
        </p>
      ) : (
        <CriteriaPreviewTable groups={groups} />
      )}

      {/* 분과별 담당자 확인 현황 — 평가표 아래에서 누가 확인했는지 한눈에 본다 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          분과별 담당자 확인 현황{" "}
          <span className="ml-0.5 text-xs text-slate-400">
            {ackedCount}/{sessions.length} 확인
          </span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {sessions.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
          ) : (
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">분과명</th>
                  <th className="px-5 py-2.5 font-medium">담당자</th>
                  <th className="px-5 py-2.5 font-medium">확인 여부</th>
                  <th className="px-5 py-2.5 font-medium">확인 시각</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/admin/sessions/${s.id}/criteria`}
                        className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {s.secretary?.name ?? <span className="text-xs text-rose-600">미배정</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      {s.criteriaAckAt ? (
                        <span className="text-xs font-bold text-slate-900">확인 완료</span>
                      ) : (
                        <span className="text-xs text-slate-900">미확인</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {s.criteriaAckAt
                        ? s.criteriaAckAt.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
