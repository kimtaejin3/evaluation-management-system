import { notFound } from "next/navigation";
import { assertSessionAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { criteriaScopeForSession } from "@/lib/criteria-scope";
import AutoPrint from "@/app/print/sheet/AutoPrint";
import SubjectScoreDoc, { type SubjectScoreData } from "./SubjectScoreDoc";

// 기업(대상)별 위원 점수표 인쇄. subjectId=all 이면 전 대상을 페이지 나눔으로 이어서 인쇄.
// 자체 인증(assertSessionAccess), 레이아웃 없음.
export default async function SubjectScoresPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; subjectId?: string }>;
}) {
  const { sessionId, subjectId } = await searchParams;
  if (!sessionId || !subjectId) notFound();
  await assertSessionAccess(sessionId);

  const all = subjectId === "all";
  const printedDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  const [session, criteria, assignments] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id: sessionId } }),
    prisma.criterion.findMany({ where: await criteriaScopeForSession(sessionId), include: { subitem: { include: { group: true } } } }),
    prisma.assignment.findMany({ where: { sessionId }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  if (!session) notFound();

  criteria.sort((a, b) => {
    const ga = a.subitem?.group.order ?? 0;
    const gb = b.subitem?.group.order ?? 0;
    if (ga !== gb) return ga - gb;
    const sa = a.subitem?.order ?? 0;
    const sb = b.subitem?.order ?? 0;
    if (sa !== sb) return sa - sb;
    return a.order - b.order;
  });
  const evaluators = assignments.map((a) => ({ id: a.userId, name: a.user.name }));

  const subjects = all
    ? await prisma.subject.findMany({ where: { sessionId }, orderBy: { name: "asc" } })
    : await prisma.subject.findMany({ where: { id: subjectId, sessionId } });
  if (subjects.length === 0) notFound();

  const subjectIds = subjects.map((s) => s.id);
  const scores = await prisma.score.findMany({
    where: { sessionId, subjectId: { in: subjectIds } },
    select: { subjectId: true, evaluatorId: true, criterionId: true, value: true },
  });

  const docs: SubjectScoreData[] = subjects.map((subject) => {
    const scoreOf = new Map<string, number>();
    for (const s of scores) if (s.subjectId === subject.id) scoreOf.set(`${s.evaluatorId}:${s.criterionId}`, s.value);
    return {
      subjectName: subject.name,
      sessionName: session.name,
      evaluators,
      criteria,
      scoreOf,
      printedDate,
    };
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>
      <AutoPrint />
      {docs.map((data, i) => (
        <SubjectScoreDoc key={subjects[i].id} data={data} pageBreak={i > 0} />
      ))}
    </div>
  );
}
