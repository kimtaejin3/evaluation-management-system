import { notFound } from "next/navigation";
import Link from "next/link";
import { assertSessionAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { criteriaScopeForSession, scoringUnitsForScope } from "@/lib/criteria-scope";
import { scoreUnitId } from "@/lib/criteria-units";
import PrintButton from "@/app/admin/sessions/[id]/results/PrintButton";
import AutoPrint from "./AutoPrint";
import SheetDoc, { type SheetDocData } from "./SheetDoc";

// 위원별 평가표 인쇄 — 관리자 레이아웃(사이드바) 없이 문서만 렌더해 iframe 로드가 빠르다.
// subjectId=all 이면 해당 위원의 모든 대상 평가표를 페이지 나눔으로 이어서 인쇄. 자체 인증(assertSessionAccess).
export default async function SheetPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; subjectId?: string; evaluatorId?: string; embed?: string }>;
}) {
  const { sessionId, subjectId, evaluatorId, embed } = await searchParams;
  if (!sessionId || !subjectId || !evaluatorId) notFound();
  const embedded = embed === "1"; // 미리보기 iframe 임베드 — 화면 툴바 숨김
  await assertSessionAccess(sessionId);

  const printedDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const all = subjectId === "all";

  const [session, evaluator, units] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id: sessionId }, include: { project: { select: { name: true, taskType: true } } } }),
    prisma.user.findUnique({ where: { id: evaluatorId }, select: { name: true } }),
    scoringUnitsForScope(await criteriaScopeForSession(sessionId)),
  ]);
  if (!session || !evaluator) notFound();

  const subjects = all
    ? await prisma.subject.findMany({ where: { sessionId }, include: { company: true }, orderBy: { name: "asc" } })
    : await prisma.subject.findMany({ where: { id: subjectId, sessionId }, include: { company: true } });
  if (subjects.length === 0) notFound();

  const subjectIds = subjects.map((s) => s.id);
  const [scores, opinions] = await Promise.all([
    prisma.score.findMany({
      where: { sessionId, evaluatorId, subjectId: { in: subjectIds } },
      select: { subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.opinion.findMany({ where: { evaluatorId, subjectId: { in: subjectIds } }, select: { subjectId: true, text: true } }),
  ]);
  const opinionOf = new Map(opinions.map((o) => [o.subjectId, o.text]));

  // 단일 모드 진행 표시용(전체 모드는 대상 수만 표시)
  const singleFilled = all ? 0 : scores.filter((s) => s.subjectId === subjects[0].id && s.value != null).length;

  const docs: SheetDocData[] = subjects.map((subject) => {
    const valueOf = new Map<string, number | null>();
    for (const s of scores) if (s.subjectId === subject.id) valueOf.set(scoreUnitId(s), s.value);
    return {
      sessionName: session.name,
      region: subject.company.region,
      taskType: session.project?.taskType ?? null,
      taskName: session.project?.name ?? null,
      companyName: subject.company.name,
      leadResearcher: subject.company.leadResearcher,
      evaluatorName: evaluator.name,
      units,
      valueOf,
      opinionText: opinionOf.get(subject.id) ?? "",
      printedDate,
    };
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 14mm; }`}</style>
      <AutoPrint />

      {/* 화면 전용 툴바 — 미리보기 임베드(embed=1)에선 숨김(중복 인쇄 버튼·오작동 방지) */}
      {!embedded && (
        <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
          <Link
            href={`/admin/sessions/${sessionId}/results`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            ← 집계결과로
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {all ? (
              <span>전체 {subjects.length}건</span>
            ) : (
              <span>
                평가지표 {singleFilled}/{units.length} 입력
                {units.length > 0 && singleFilled < units.length && (
                  <span className="ml-1 text-amber-600">· 미입력 {units.length - singleFilled}</span>
                )}
              </span>
            )}
            <PrintButton />
          </div>
        </div>
      )}

      {docs.map((data, i) => (
        <SheetDoc key={subjects[i].id} data={data} pageBreak={i > 0} />
      ))}
    </div>
  );
}
