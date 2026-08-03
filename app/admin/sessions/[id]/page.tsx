import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtYmd } from "@/lib/dates";
import { getSessionProgress } from "@/lib/progress";
import MonitoringList from "@/components/MonitoringList";
import EvaluatorRoster from "@/components/EvaluatorRoster";
import LiveRefresher from "@/components/LiveRefresher";
import SessionStatusControl from "@/components/SessionStatusControl";
import {
  SkeletonCard,
  SkeletonStats,
  SkeletonTable,
} from "@/components/Skeletons";

export default async function SessionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <Suspense fallback={<SkeletonCard lines={4} />}>
        <SessionInfo id={id} />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
            <SkeletonStats count={4} colsClass="sm:grid-cols-4" />
            <SkeletonTable rows={4} cols={4} />
          </div>
        }
      >
        <MonitoringSection id={id} />
      </Suspense>
    </div>
  );
}

// 분과 정보 카드 (단일 쿼리)
async function SessionInfo({ id }: { id: string }) {
  const session = await prisma.evaluationSession.findUnique({
    where: { id },
    include: {
      _count: { select: { subjects: true, assignments: true } },
      secretary: { select: { name: true } },
    },
  });
  // 평가항목은 사업(Project) 단위 공통 — 소속 사업의 항목 수를 센다.
  const criteriaCount = session
    ? await prisma.criterion.count({
        where: session.projectId ? { projectId: session.projectId } : { sessionId: id },
      })
    : 0;
  if (!session) notFound();

  const fmtDate = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "—";
  const meta: { label: string; value: string }[] = [
    { label: "담당자", value: session.secretary?.name ?? "미배정" },
    {
      label: "평가 기간",
      value:
        session.startDate || session.endDate
          ? `${fmtYmd(session.startDate)} ~ ${fmtYmd(session.endDate)}`
          : fmtYmd(session.eventDate),
    },
    { label: "평가 항목 수", value: `${criteriaCount}개` },
    { label: "평가 대상 수", value: `${session._count.subjects}개` },
    { label: "평가위원 수", value: `${session._count.assignments}명` },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <SessionStatusControl
          sessionId={session.id}
          status={session.status}
          eventDate={session.eventDate ? session.eventDate.toISOString() : null}
        />
      </div>
      {/* 분과 정보 — 라벨을 헤더로, 값을 한 행으로 하는 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {meta.map((m) => (
                <th key={m.label} className="px-5 py-2.5 font-medium whitespace-nowrap">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {meta.map((m) => (
                <td key={m.label} className="px-5 py-3 text-lg font-bold whitespace-nowrap text-slate-900">
                  {m.value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 실시간 모니터링 대시보드 (진행률 집계 — 무거운 쿼리)
async function MonitoringSection({ id }: { id: string }) {
  const p = await getSessionProgress(id);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">실시간 모니터링</h2>
        <LiveRefresher sessionId={id} />
      </div>

      {/* KPI — 지표를 헤더로, 값을 한 행으로 하는 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-5 py-2.5 font-medium whitespace-nowrap">평가 위원</th>
              <th className="px-5 py-2.5 font-medium whitespace-nowrap">입력 완료 위원</th>
              <th className="px-5 py-2.5 font-medium whitespace-nowrap">진행률</th>
              <th className="px-5 py-2.5 font-medium whitespace-nowrap">평가 대상</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-5 py-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-bold text-slate-900">{p.assignedCount}명</span>
                  <EvaluatorRoster evaluators={p.rows} subjects={p.subjects} />
                </div>
              </td>
              <td className="px-5 py-3 text-lg font-bold text-slate-900">
                {p.completedEvaluators}/{p.assignedCount}
              </td>
              <td className="px-5 py-3 text-lg font-bold text-indigo-600">{p.pct}%</td>
              <td className="px-5 py-3 text-lg font-bold text-slate-900">{p.subjects.length}개</td>
            </tr>
          </tbody>
        </table>
      </div>

      <MonitoringList data={p} />
    </section>
  );
}
