import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { getSessionProgress } from "@/lib/progress";
import { fmtYmd, fmtDateTimeKst } from "@/lib/dates";
import ExcelExportButton from "@/components/ExcelExportButton";
import TableRefreshControl from "@/components/TableRefreshControl";
import { parseSessionSort, sortSessions, type SessionSortField } from "@/lib/session-sort";
import MonitoringSessionsTable from "@/components/MonitoringSessionsTable";
import { SkeletonTable } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 사업 실시간 모니터링 — 분과별 채점 진행 현황을 테이블 뷰로 한눈에.
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
  const { user } = await assertProjectAccess(id);
  const isMaster = user.role === "MASTER";
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

  const rows = sessions.map((s, i) => {
    const p = progress[i];
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      period: fmtPeriod(s),
      secretaryName: s.secretary?.name ?? null,
      subjectCount: p.subjects.length,
      assignedCount: p.assignedCount,
      completedEvaluators: p.completedEvaluators,
      written: opinionOf.get(s.id) ?? 0,
      expected: p.assignedCount * p.subjects.length,
    };
  });

  return <MonitoringSessionsTable projectId={id} rows={rows} isMaster={isMaster} sort={sort} dir={dir} />;
}
