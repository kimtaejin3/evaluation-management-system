import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtYmd } from "@/lib/dates";
import type { Prisma } from "@prisma/client";
import { requireAdminUser } from "@/lib/authz";
import SessionListTable, { type SessionListRow } from "@/components/SessionListTable";
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
  // 담당자는 자기 분과만(마스터 전부)
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

  // 평가항목은 사업(Project) 단위 공통 — 사업별 항목 수를 한 번에 집계
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

  const rows: SessionListRow[] = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    criterionCount: s.projectId ? (critByProject.get(s.projectId) ?? 0) : 0,
    subjectCount: s._count.subjects,
    assignmentCount: s._count.assignments,
    periodLabel:
      s.startDate || s.endDate
        ? `${fmtYmd(s.startDate)} ~ ${fmtYmd(s.endDate)}`
        : s.eventDate
          ? fmtYmd(s.eventDate)
          : "",
    startDate: s.startDate ? s.startDate.toISOString().slice(0, 10) : "",
  }));

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

      <SessionListTable rows={rows} />
    </>
  );
}
