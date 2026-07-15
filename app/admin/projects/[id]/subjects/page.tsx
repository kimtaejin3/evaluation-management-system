import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import { computeWeightedScore } from "@/lib/scoring";
import ProjectSubjectsTable, { type ProjectSubjectRow } from "@/components/ProjectSubjectsTable";
import { SkeletonTable } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

// 과제 평가대상 — 분과 단위 행으로 한눈에.
// 분과명 클릭 → 분과 평가 대상 페이지(기업 자료 제출 조회), 점수 '자세히 보기' → 위원별 점수 매트릭스.
export default async function ProjectSubjectsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 제목·설명은 정적이므로 Suspense 밖에서 즉시 렌더 — 로딩 중에도 보인다.
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/projects/${id}`} className="text-sm text-slate-400 hover:text-slate-600">
          ← 분과 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold">평가대상</h1>
        <p className="mt-1 text-sm text-slate-500">
          분과별 평가 대상 현황입니다. 분과명을 누르면 기업 자료 제출 현황을 조회할 수 있습니다.
        </p>
      </div>
      <Suspense fallback={<SkeletonTable rows={6} cols={5} />}>
        <Content id={id} />
      </Suspense>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  const { user } = await assertProjectAccess(id);
  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      subjectReviewStatus: true,
      evaluatorStatus: true,
      secretary: { select: { name: true } },
    },
  });
  const isMaster = user.role === "MASTER";
  const sessionIds = sessions.map((s) => s.id);

  // 위원별 점수 매트릭스 — 배정 상태와 무관하게, 전 항목을 입력한 (위원×대상)만 총점 산출.
  // 평가항목은 과제 단위 공통이므로 한 번만 읽는다.
  const [criteria, subjects, assignments, scores] = await Promise.all([
    prisma.criterion.findMany({ where: { projectId: id }, select: { id: true, weight: true } }),
    prisma.subject.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, sessionId: true },
    }),
    prisma.assignment.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { createdAt: "asc" },
      select: { sessionId: true, userId: true, user: { select: { name: true } } },
    }),
    prisma.score.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, evaluatorId: true, subjectId: true, criterionId: true, value: true },
    }),
  ]);
  const totalCriteria = criteria.length;

  // (위원:대상)별 입력 점수 묶음
  const scoreRows = new Map<string, { criterionId: string; value: number }[]>();
  for (const sc of scores) {
    const k = `${sc.evaluatorId}:${sc.subjectId}`;
    if (!scoreRows.has(k)) scoreRows.set(k, []);
    scoreRows.get(k)!.push({ criterionId: sc.criterionId, value: sc.value });
  }

  const rows: ProjectSubjectRow[] = sessions.map((s) => {
    const sessionSubjects = subjects.filter((sub) => sub.sessionId === s.id).map(({ id: sid, name }) => ({ id: sid, name }));
    // 간사가 평가위원 배정을 제출(SUBMITTED/APPROVED)하기 전에는 관리자에게 위원 명단을 숨긴다(마감 분과 예외)
    const evaluatorsHidden =
      isMaster &&
      s.status !== "CLOSED" &&
      s.evaluatorStatus !== "SUBMITTED" &&
      s.evaluatorStatus !== "APPROVED";
    const sessionEvaluators = evaluatorsHidden
      ? []
      : assignments
          .filter((a) => a.sessionId === s.id)
          .map((a) => ({ id: a.userId, name: a.user.name }));
    const totals: Record<string, number | null> = {};
    for (const e of sessionEvaluators) {
      for (const sub of sessionSubjects) {
        const rows0 = scoreRows.get(`${e.id}:${sub.id}`) ?? [];
        totals[`${e.id}:${sub.id}`] =
          totalCriteria > 0 && rows0.length >= totalCriteria ? computeWeightedScore(rows0, criteria) : null;
      }
    }
    return {
      sessionId: s.id,
      name: s.name,
      secretaryName: s.secretary?.name ?? null,
      reviewStatus: s.subjectReviewStatus,
      subjectCount: sessionSubjects.length,
      evaluators: sessionEvaluators,
      subjects: sessionSubjects,
      totals,
      evaluatorsHidden,
    };
  });

  return <ProjectSubjectsTable rows={rows} isMaster={isMaster} />;
}
