import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/authz";
import SessionOpinionsModal from "@/components/SessionOpinionsModal";
import ReviewStatusBadge from "@/components/ReviewStatusBadge";
import ReviewDecisionButtons from "@/components/ReviewDecisionButtons";
import ExcelExportButton from "@/components/ExcelExportButton";
import { SkeletonTable } from "@/components/Skeletons";

// 과제 평가의견서 — 분과별 의견서 작성 현황을 테이블 뷰로 한눈에.
// 의견서 본문 열람·승인/반려는 분과의 평가 의견서 페이지에서 한다.
export default async function ProjectOpinionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 제목·설명은 정적이므로 Suspense 밖에서 즉시 렌더 — 로딩 중에도 보인다.
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-bold">평가의견서</h1>
        </div>
        <ExcelExportButton href={`/api/projects/${id}/export/opinions`} />
      </div>
      <Suspense fallback={<SkeletonTable rows={5} cols={6} />}>
        <Content id={id} />
      </Suspense>
      <p className="text-left text-xs text-slate-400">
        분과별 의견서 작성 현황입니다. ‘자세히 보기’로 평가위원장 종합의견을 확인합니다.
      </p>
    </div>
  );
}

async function Content({ id }: { id: string }) {
  const { user } = await assertProjectAccess(id);
  const isMaster = user.role === "MASTER";
  const sessions = await prisma.evaluationSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      opinionStatus: true,
      chairId: true,
      secretary: { select: { name: true } },
      _count: { select: { subjects: true } },
      subjects: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      assignments: { select: { userId: true, user: { select: { name: true } } } },
    },
  });

  // 의견서 본문 — Opinion은 세션 관계가 없어 sessionId로 한 번에 조회한 뒤 분과별로 묶는다.
  const opinions = await prisma.opinion.findMany({
    where: { sessionId: { in: sessions.map((s) => s.id) } },
    select: { sessionId: true, evaluatorId: true, subjectId: true, text: true },
  });
  const opinionsOfSession = new Map<string, typeof opinions>();
  for (const o of opinions) {
    if (!opinionsOfSession.has(o.sessionId)) opinionsOfSession.set(o.sessionId, []);
    opinionsOfSession.get(o.sessionId)!.push(o);
  }

  // 분과별 (위원장 이름, 대상별 종합의견) — 모달에 넘길 데이터
  const detailOf = (s: (typeof sessions)[number]) => {
    const chairName = s.assignments.find((a) => a.userId === s.chairId)?.user.name ?? null;
    const nameOfSubject = new Map(s.subjects.map((x) => [x.id, x.name]));
    const items = (opinionsOfSession.get(s.id) ?? [])
      .filter((o) => o.evaluatorId === s.chairId && o.text.trim())
      .map((o) => ({ subjectName: nameOfSubject.get(o.subjectId) ?? "", text: o.text }))
      .filter((it) => it.subjectName)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "ko"));
    return { chairName, items };
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">담당 간사</th>
                <th className="px-5 py-3 font-medium">간사 검토</th>
                <th className="px-5 py-3 font-medium">평가 대상 수</th>
                <th className="px-5 py-3 font-medium">자세히 보기</th>
                <th className="px-5 py-3 font-medium">승인 상태</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const detail = detailOf(s);
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      {/* 이동은 '자세히 보기'로 — 분과명은 일반 텍스트 */}
                      <span className="font-medium text-slate-800">{s.name}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.secretary?.name ?? <span className="text-xs text-rose-600">미배정</span>}
                    </td>
                    <td className="px-5 py-3">
                      {/* 간사 검토 상태 — 의견서는 간사가 '검토'하는 도메인 */}
                      <ReviewStatusBadge status={s.opinionStatus} wording="review" />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s._count.subjects}</td>
                    <td className="px-5 py-3">
                      {/* 페이지 이동 없이 모달로 의견서 열람 */}
                      <SessionOpinionsModal
                        sessionName={s.name}
                        chairName={detail.chairName}
                        items={detail.items}
                      />
                    </td>
                    <td className="px-5 py-3">
                      {/* 승인 상태 — 배지 없이 승인/반려 버튼으로만 판단 */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isMaster && (
                          <ReviewDecisionButtons sessionId={s.id} status={s.opinionStatus} kind="opinions" wording="review" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
    </div>
  );
}
