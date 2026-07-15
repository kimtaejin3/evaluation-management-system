import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requireAdminUser } from "@/lib/authz";
import StatusBadge from "@/components/StatusBadge";
import DeleteSessionButton from "@/components/DeleteSessionButton";
import { SkeletonTable } from "@/components/Skeletons";

const STATUS_OPTIONS = [
  { value: "", label: "상태 전체" },
  { value: "DRAFT", label: "초안" },
  { value: "IN_PROGRESS", label: "진행중" },
  { value: "CLOSED", label: "마감" },
];

// 분과의 연도(평가 일시 우선, 없으면 생성일)
function sessionYear(s: { eventDate: Date | null; createdAt: Date }): number {
  return new Date(s.eventDate ?? s.createdAt).getFullYear();
}

export default function SessionListPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">분과 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            분과 생성 · 편집 · 마감
          </p>
        </div>
        <Link
          href="/admin/sessions/new"
          className="rounded-md bg-[var(--gov-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
        >
          + 새 분과
        </Link>
      </div>

      <Suspense fallback={<SkeletonTable rows={6} cols={7} />}>
        <SessionList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SessionList({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  const { year, status } = await searchParams;
  const user = await requireAdminUser();
  const where: Prisma.EvaluationSessionWhereInput = {};
  // 간사는 자기 분과만(마스터 전부)
  if (user.role !== "MASTER") where.secretaryId = user.id;
  if (status === "DRAFT" || status === "IN_PROGRESS" || status === "CLOSED")
    where.status = status;

  const all = await prisma.evaluationSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { subjects: true, assignments: true } },
    },
  });

  // 평가항목은 과제(Project) 단위 공통 — 과제별 항목 수를 한 번에 집계
  const projectIds = [...new Set(all.map((s) => s.projectId).filter((v): v is string => !!v))];
  const critByProject = new Map(
    (
      await prisma.criterion.groupBy({
        by: ["projectId"],
        where: { projectId: { in: projectIds } },
        _count: { _all: true },
      })
    ).map((g) => [g.projectId, g._count._all]),
  );

  // 연도 옵션(전체 분과 기준) + 필터 적용
  const years = [...new Set(all.map(sessionYear))].sort((a, b) => b - a);
  const sessions = year
    ? all.filter((s) => String(sessionYear(s)) === year)
    : all;

  return (
    <>
      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <select
          name="year"
          defaultValue={year ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">연도 전체</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}년
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
          적용
        </button>
      </form>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-5 py-3 font-semibold">분과명</th>
              <th className="px-5 py-3 font-semibold">상태</th>
              <th className="px-5 py-3 font-semibold">항목</th>
              <th className="px-5 py-3 font-semibold">대상</th>
              <th className="px-5 py-3 font-semibold">위원</th>
              <th className="px-5 py-3 font-semibold">종료일</th>
              <th className="px-5 py-3 font-semibold">동작</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                className="relative border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-5 py-3 font-medium text-slate-800">
                  {/* 행 전체 클릭 → 관리 진입 */}
                  <Link href={`/admin/sessions/${s.id}`} aria-label={`${s.name} 관리`} className="absolute inset-0" />
                  {s.name}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {s.projectId ? (critByProject.get(s.projectId) ?? 0) : 0}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {s._count.subjects}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {s._count.assignments}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {s.endDate
                    ? new Date(s.endDate).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </td>
                <td className="px-5 py-3">
                  <div className="relative z-10 flex items-center gap-3">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="text-[var(--gov-primary)] hover:underline"
                    >
                      관리
                    </Link>
                    <DeleteSessionButton sessionId={s.id} sessionName={s.name} />
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  조회된 분과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
