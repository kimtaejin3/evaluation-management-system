import { notFound } from "next/navigation";
import Link from "next/link";
import { assertSessionAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import PrintButton from "../results/PrintButton";
import AutoPrint from "./AutoPrint";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Item = { id: string; name: string; maxScore: number; value: number | null };
type Sub = { name: string; items: Item[] };
type Grp = { name: string; subs: Sub[] };

// 관리자용 — 특정 평가위원이 특정 과제에 매긴 평가표를 공식 양식으로 인쇄/PDF.
// 진입: 집계결과(results) 페이지의 "위원별 평가표 인쇄" 링크.
export default async function AdminSheetPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ subjectId?: string; evaluatorId?: string }>;
}) {
  const { id } = await params;
  const { subjectId, evaluatorId } = await searchParams;
  await assertSessionAccess(id);
  if (!subjectId || !evaluatorId) notFound();

  const [session, subject, evaluator, criteria, scores, opinion] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.subject.findUnique({ where: { id: subjectId }, include: { company: true } }),
    prisma.user.findUnique({ where: { id: evaluatorId }, select: { name: true } }),
    prisma.criterion.findMany({
      where: { sessionId: id },
      include: { subitem: { include: { group: true } } },
    }),
    prisma.score.findMany({ where: { sessionId: id, subjectId, evaluatorId }, select: { criterionId: true, value: true } }),
    prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId, subjectId } }, select: { text: true } }),
  ]);
  if (!session || !subject || !evaluator || subject.sessionId !== id) notFound();

  // 평가항목(group) → 세부항목(subitem) → 평가지표(criterion) 순 정렬
  criteria.sort((a, b) => {
    const ga = a.subitem?.group.order ?? 0;
    const gb = b.subitem?.group.order ?? 0;
    if (ga !== gb) return ga - gb;
    const sa = a.subitem?.order ?? 0;
    const sb = b.subitem?.order ?? 0;
    if (sa !== sb) return sa - sb;
    return a.order - b.order;
  });

  const valueOf = new Map(scores.map((s) => [s.criterionId, s.value]));
  const groups: Grp[] = [];
  for (const c of criteria) {
    const gName = c.subitem?.group.name ?? "미분류";
    const sName = c.subitem?.name ?? "";
    let g = groups.find((x) => x.name === gName);
    if (!g) {
      g = { name: gName, subs: [] };
      groups.push(g);
    }
    let sg = g.subs.find((x) => x.name === sName);
    if (!sg) {
      sg = { name: sName, items: [] };
      g.subs.push(sg);
    }
    sg.items.push({ id: c.id, name: c.name, maxScore: c.maxScore, value: valueOf.get(c.id) ?? null });
  }

  const maxTotal = criteria.reduce((s, c) => s + c.maxScore, 0);
  const total = criteria.reduce((s, c) => s + (valueOf.get(c.id) ?? 0), 0);
  const filled = criteria.filter((c) => valueOf.get(c.id) != null).length;
  const printedDate = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  const th = "border border-black bg-slate-100 px-3 py-1.5 text-left text-sm font-medium print:bg-transparent";
  const td = "border border-black px-3 py-1.5 text-sm";

  return (
    <div>
      {/* A4 여백 */}
      <style>{`@page { size: A4; margin: 14mm; }`}</style>
      {/* 진입 시 브라우저 인쇄 대화상자 자동 표시 */}
      <AutoPrint />

      {/* 화면 전용 툴바 */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/admin/sessions/${id}/results`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          ← 집계결과로
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            평가지표 {filled}/{criteria.length} 입력
            {criteria.length > 0 && filled < criteria.length && (
              <span className="ml-1 text-amber-600">· 미입력 {criteria.length - filled}</span>
            )}
          </span>
          <PrintButton />
        </div>
      </div>

      {/* 평가표 문서 — 화면에서는 여백·그림자로 A4 미리보기처럼, 인쇄 시 여백은 @page가 담당(문서 패딩 제거) */}
      <div className="mx-auto max-w-[210mm] rounded-lg bg-white p-8 text-slate-900 shadow-sm ring-1 ring-slate-200 sm:p-12 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <h1 className="text-center text-xl font-bold tracking-tight">{session.name} 평가표</h1>

        {/* 헤더 메타 */}
        <table className="mt-4 w-full border-collapse">
          <tbody>
            <tr>
              <th className={`${th} w-32`}>지역</th>
              <td className={td}>{subject.region ?? ""}</td>
              <th className={`${th} w-32`}>과제유형</th>
              <td className={td}>{subject.taskType ?? ""}</td>
            </tr>
            <tr>
              <th className={th}>과제명</th>
              <td className={td} colSpan={3}>{subject.taskName ?? ""}</td>
            </tr>
            <tr>
              <th className={th}>주관연구개발기관</th>
              <td className={td}>{subject.company.name}</td>
              <th className={th}>연구책임자</th>
              <td className={td}>{subject.leadResearcher ?? ""}</td>
            </tr>
          </tbody>
        </table>

        {/* 평가표 */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-center`}>평가 항목</th>
              <th className={`${th} text-center`}>세부항목</th>
              <th className={`${th} text-center`}>평가 지표</th>
              <th className={`${th} w-16 text-center`}>배점</th>
              <th className={`${th} w-16 text-center`}>평점</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const groupRowSpan = g.subs.reduce((n, s) => n + Math.max(1, s.items.length), 0) || 1;
              const gTotal = g.subs.reduce((n, s) => n + s.items.reduce((m, i) => m + i.maxScore, 0), 0);
              let groupPlaced = false;
              return g.subs.map((sg) => {
                const subRowSpan = Math.max(1, sg.items.length);
                return sg.items.map((c, cIdx) => {
                  const cells: React.ReactNode[] = [];
                  if (!groupPlaced) {
                    cells.push(
                      <td key="g" rowSpan={groupRowSpan} className={`${td} align-top`}>
                        <span className="font-semibold">{g.name}</span>
                        <span className="ml-1 text-xs text-slate-500">({gTotal})</span>
                      </td>,
                    );
                    groupPlaced = true;
                  }
                  if (cIdx === 0) {
                    cells.push(
                      <td key="s" rowSpan={subRowSpan} className={`${td} align-top`}>
                        {sg.name || "—"}
                      </td>,
                    );
                  }
                  cells.push(
                    <td key="c" className={`${td} align-top`}>{c.name}</td>,
                    <td key="m" className={`${td} text-center tabular-nums align-top`}>{c.maxScore}</td>,
                    <td key="v" className={`${td} text-center font-semibold tabular-nums align-top`}>
                      {c.value != null ? fmt(c.value) : ""}
                    </td>,
                  );
                  return <tr key={c.id}>{cells}</tr>;
                });
              });
            })}
            {criteria.length === 0 && (
              <tr>
                <td colSpan={5} className={`${td} py-8 text-center text-slate-400`}>평가 항목이 없습니다.</td>
              </tr>
            )}
            <tr className="font-semibold">
              <td colSpan={3} className={`${td} text-center`}>합 계</td>
              <td className={`${td} text-center tabular-nums`}>{fmt(maxTotal)}</td>
              <td className={`${td} text-center tabular-nums`}>{fmt(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* 평가의견 */}
        <table className="mt-3 w-full border-collapse">
          <tbody>
            <tr>
              <th className={`${th} w-32 align-top`}>평가의견</th>
              <td className={`${td} align-top`}>
                <div className="min-h-24 whitespace-pre-wrap">{opinion?.text || ""}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 서명란 */}
        <div className="mt-8 text-center text-sm">
          <div>{printedDate}</div>
          <div className="mt-3">
            평가위원 : <span className="font-semibold">{evaluator.name}</span>
            <span className="ml-1 text-slate-500">(인)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
