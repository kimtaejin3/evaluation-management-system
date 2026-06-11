import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionProgress } from "@/lib/progress";
import StatusBadge from "@/components/StatusBadge";
import SessionPicker from "@/components/SessionPicker";
import MonitoringGrid from "@/components/MonitoringGrid";
import Clock from "@/components/Clock";

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
            <span className="text-slate-400">현재 시각</span>{" "}
            <span className="font-medium text-slate-700">
              <Clock />
            </span>
            <span className="mx-2 text-slate-300">·</span>
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
          { label: "입력 완료 위원", value: `${p.completedEvaluators}/${p.assignedCount}` },
          { label: "진행률", value: `${p.pct}%`, accent: true, hint: `${p.doneCells}/${p.totalCells} 칸` },
          { label: "평가 대상", value: `${p.subjects.length}개` },
        ].map((k, i) => (
          <div key={k.label} className={i === 0 ? "sm:pr-6" : "sm:px-6"}>
            <div className="text-sm text-slate-500">{k.label}</div>
            <div className={`mt-1 text-2xl font-bold ${k.accent ? "text-indigo-600" : "text-slate-900"}`}>
              {k.value}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{k.hint ?? " "}</div>
          </div>
        ))}
      </div>

      {/* 모니터링 그리드 */}
      <MonitoringGrid data={p} />

      {/* 대상별 진행 요약 */}
      <div className="space-y-2.5">
        <h2 className="text-sm font-semibold text-slate-700">대상별 진행 요약</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-2.5 font-medium">대상</th>
                <th className="px-4 py-2.5 font-medium">입력 완료 위원</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {p.subjectSummary.map((s) => {
                const complete = s.total > 0 && s.done === s.total;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {s.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {s.done}/{s.total}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        {complete ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gov-primary)]" />
                        ) : (
                          <span className="relative h-2.5 w-2.5 rounded-full ring-1 ring-slate-400">
                            <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400" />
                          </span>
                        )}
                        {complete ? "완료" : "진행중"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {p.subjectSummary.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    평가 대상이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
