import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { SkeletonCard } from "@/components/Skeletons";
import OpinionViewer from "./OpinionViewer";

export default async function OpinionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      }
    >
      <OpinionsContent id={id} />
    </Suspense>
  );
}

async function OpinionsContent({ id }: { id: string }) {
  const [session, assignments, subjects, opinions] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: { select: { id: true, name: true } } } }),
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { name: "asc" } }),
    prisma.opinion.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, text: true } }),
  ]);

  // (위원:대상) → 종합의견 텍스트
  const opinionOf = new Map<string, string>();
  for (const o of opinions) if (o.text.trim()) opinionOf.set(`${o.evaluatorId}:${o.subjectId}`, o.text);

  // 위원장을 맨 앞에
  const chairId = session?.chairId ?? null;
  const evaluators = [...assignments]
    .sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))
    .map((a) => ({ id: a.userId, name: a.user.name, isChair: a.userId === chairId }));

  const subjectNameOf = new Map(subjects.map((s) => [s.id, s.name]));

  // 텍스트가 있는 (위원 × 지원기업) 조합만 flat 리스트로 구성
  const items = evaluators
    .flatMap((ev) =>
      subjects
        .filter((s) => opinionOf.has(`${ev.id}:${s.id}`))
        .map((s) => ({
          evaluatorId: ev.id,
          evaluatorName: ev.name,
          isChair: ev.isChair,
          subjectId: s.id,
          subjectName: subjectNameOf.get(s.id) ?? "",
          text: opinionOf.get(`${ev.id}:${s.id}`) ?? "",
        })),
    )
    .filter((item) => item.subjectName);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        평가위원이 각 지원기업에 대해 평가 화면에서 작성한 종합의견입니다.
      </p>

      {evaluators.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-slate-400">
          배정된 평가위원이 없습니다.
        </div>
      ) : (
        <OpinionViewer items={items} />
      )}
    </div>
  );
}
