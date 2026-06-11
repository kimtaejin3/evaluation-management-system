import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionProgress, getSessionInsights } from "@/lib/progress";
import StatusBadge from "@/components/StatusBadge";
import SessionPicker from "@/components/SessionPicker";
import MonitoringGrid from "@/components/MonitoringGrid";
import DashboardInsights from "@/components/DashboardInsights";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const sp = await searchParams;
  const sessions = await prisma.evaluationSession.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, eventDate: true },
  });

  if (sessions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          아직 회차가 없습니다.{" "}
          <Link
            href="/admin/sessions/new"
            className="text-indigo-600 hover:underline"
          >
            새 회차 만들기
          </Link>
        </div>
      </div>
    );
  }

  const session =
    sessions.find((s) => s.id === sp.session) ??
    sessions.find((s) => s.status === "IN_PROGRESS") ??
    sessions[0];

  const p = await getSessionProgress(session.id);
  const insights = await getSessionInsights(session.id);

  return (
    <div className="space-y-7">
      {/* 헤더 (플랫) */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <SessionPicker sessions={sessions} currentId={session.id} />
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            <span className="text-slate-400">평가 일시</span>{" "}
            <span className="font-medium text-slate-700">
              {session.eventDate
                ? new Date(session.eventDate).toLocaleString("ko-KR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "미정"}
            </span>
          </p>
        </div>
        <Link
          href={`/admin/sessions/${session.id}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          회차 관리 →
        </Link>
      </div>

      {/* KPI 스탯 스트립 (카드 대신 구분선) */}
      <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-slate-200">
        {[
          { label: "배정 위원", value: `${p.assignedCount}명` },
          {
            label: "입력 완료 위원",
            value: `${p.completedEvaluators}/${p.assignedCount}`,
          },
          {
            label: "진행률",
            value: `${p.pct}%`,
            accent: true,
            hint: `${p.doneCells}/${p.totalCells} 칸`,
          },
          { label: "평가 대상", value: `${p.subjects.length}개` },
        ].map((k, i) => (
          <div key={k.label} className={i === 0 ? "sm:pr-6" : "sm:px-6"}>
            <div className="text-sm text-slate-500">{k.label}</div>
            <div
              className={`mt-1 text-2xl font-bold ${k.accent ? "text-indigo-600" : "text-slate-900"}`}
            >
              {k.value}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{k.hint ?? " "}</div>
          </div>
        ))}
      </div>

      {/* 모니터링 그리드 */}
      <MonitoringGrid data={p} />

      {/* 잠정 순위 · 위원 간 편차 */}
      <DashboardInsights data={insights} />
    </div>
  );
}
