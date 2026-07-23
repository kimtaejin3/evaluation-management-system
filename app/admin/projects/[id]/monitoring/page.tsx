import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { getSessionProgress } from "@/lib/progress";
import { fmtYmd, fmtDateTimeKst } from "@/lib/dates";
import ExcelExportButton from "@/components/ExcelExportButton";
import TableRefreshControl from "@/components/TableRefreshControl";
import SortableTh from "@/components/SortableTh";
import { parseSessionSort, sortSessions, type SessionSortField } from "@/lib/session-sort";
import StatusBadge from "@/components/StatusBadge";
import { SkeletonTable } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 과제 실시간 모니터링 — 분과별 채점 진행 현황을 테이블 뷰로 한눈에.
// 분과명을 클릭하면 해당 분과의 상세 모니터링(위원×대상 그리드)으로 이동한다.
export default async function ProjectMonitoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const { id } = await params;
  const { sort, dir } = parseSessionSort(await searchParams);
  // 제목·설명은 정적이므로 Suspense 밖에서 즉시 렌더 — 로딩 중에도 보인다.
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-bold">평가 실시간 모니터링</h1>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/monitoring`} />
      </div>
      {/* 조회 시각·새로고침은 제목 행과 분리해 테이블 바로 위에 붙인다 */}
      <div className="space-y-2">
        <div className="flex justify-end">
          {/* 테이블 데이터를 가져온 시각 — 5분마다 자동 새로고침, 버튼으로 즉시 갱신 */}
          <TableRefreshControl fetchedAt={fmtDateTimeKst(new Date())} />
        </div>
        <Suspense fallback={<SkeletonTable rows={5} cols={9} />}>
          <Content id={id} sort={sort} dir={dir} />
        </Suspense>
      </div>
      <p className="text-left text-xs text-slate-400">
        분과별 채점 진행 현황입니다. ‘자세히 보기’로 상세 현황을 확인합니다.
      </p>
    </div>
  );
}

const fmtPeriod = (s: { startDate: Date | null; endDate: Date | null; eventDate: Date | null }) =>
  s.startDate || s.endDate
    ? `${fmtYmd(s.startDate)} ~ ${fmtYmd(s.endDate)}`
    : s.eventDate
      ? fmtYmd(s.eventDate)
      : "미정";

async function Content({
  id,
  sort,
  dir,
}: {
  id: string;
  sort?: SessionSortField;
  dir: "asc" | "desc";
}) {
  await assertProjectAccess(id);
  const fetched = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      eventDate: true,
      secretary: { select: { name: true } },
    },
  });
  // 분과명·평가 기간 헤더 클릭 정렬 적용(진행률 계산 전에 정렬해 인덱스 정합 유지)
  const sessions = sortSessions(fetched, sort, dir);

  const progress = await Promise.all(sessions.map((s) => getSessionProgress(s.id)));

  // 분과별 작성된 평가 의견서 수
  const opinionCounts = await prisma.opinion.groupBy({
    by: ["sessionId"],
    where: { sessionId: { in: sessions.map((s) => s.id) } },
    _count: { _all: true },
  });
  const opinionOf = new Map(opinionCounts.map((o) => [o.sessionId, o._count._all]));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <SortableTh label="분과명" field="name" sort={sort} dir={dir} basePath={`/admin/projects/${id}/monitoring`} />
                <th className="px-5 py-3 font-medium">평가 상태</th>
                <SortableTh label="평가 기간" field="period" sort={sort} dir={dir} basePath={`/admin/projects/${id}/monitoring`} />
                <th className="px-5 py-3 font-medium">담당 간사</th>
                <th className="px-5 py-3 font-medium">평가 대상 수</th>
                <th className="px-5 py-3 font-medium">평가위원 수</th>
                <th className="px-5 py-3 font-medium">완료 위원</th>
                <th className="px-5 py-3 font-medium">평가 의견서</th>
                <th className="px-5 py-3 font-medium">자세히 보기</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const p = progress[i];
                const written = opinionOf.get(s.id) ?? 0;
                const expected = p.assignedCount * p.subjects.length;
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      {/* 이동은 '자세히 보기'로 — 분과명은 일반 텍스트 */}
                      <span className="font-medium text-slate-800">{s.name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{fmtPeriod(s)}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.secretary?.name ?? <span className="text-xs text-rose-600">미배정</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.subjects.length}</td>
                    <td className="px-5 py-3 text-slate-600">{p.assignedCount}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.completedEvaluators}/{p.assignedCount}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <span className="tabular-nums">
                        {written}
                        {expected > 0 && <span className="text-slate-400">/{expected}</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/sessions/${s.id}`}
                        className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                      >
                        자세히 보기
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
    </div>
  );
}
