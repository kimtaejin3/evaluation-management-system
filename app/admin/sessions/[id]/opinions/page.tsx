import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/authz";
import { criteriaScopeForSession, scoringUnitsForScope } from "@/lib/criteria-scope";
import { scoreUnitId } from "@/lib/criteria-units";
import { computeWeightedScore } from "@/lib/scoring";
import { SkeletonCard } from "@/components/Skeletons";
import ExcelExportButton from "@/components/ExcelExportButton";
import ReviewWorkflowPanel, { type ReviewStatus } from "@/components/ReviewWorkflowPanel";
import {
  submitOpinions,
  cancelSubmitOpinions,
  approveOpinions,
  rejectOpinions,
} from "../../actions";
import OpinionViewer from "./OpinionViewer";
import SubjectScoresDetail from "@/components/SubjectScoresDetail";

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
  const me = await requireAdminUser();
  const isMaster = me.role === "MASTER";
  // 평가항목은 과제(Project) 단위 공통 — 채점 단위(지표별/통합) 기준으로 점수 계산
  const criteriaWhere = await criteriaScopeForSession(id);
  const [session, assignments, subjects, opinions, units, scores] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: { select: { id: true, name: true } } } }),
    // chairOpinion(위원장 통합의견)은 대상 자체에 저장된다
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { name: "asc" } }),
    prisma.opinion.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, text: true } }),
    scoringUnitsForScope(criteriaWhere),
    prisma.score.findMany({
      where: { sessionId: id },
      select: { evaluatorId: true, subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
  ]);

  // (위원:대상)별 총점 — 전 단위를 입력한 조합만 산출(그 외 null)
  const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }));
  const totalCriteria = units.length;
  const scoreRowsOf = new Map<string, { criterionId: string; value: number }[]>();
  for (const sc of scores) {
    const k = `${sc.evaluatorId}:${sc.subjectId}`;
    if (!scoreRowsOf.has(k)) scoreRowsOf.set(k, []);
    scoreRowsOf.get(k)!.push({ criterionId: scoreUnitId(sc), value: sc.value });
  }
  const totalOf = (evaluatorId: string, subjectId: string): number | null => {
    const rows = scoreRowsOf.get(`${evaluatorId}:${subjectId}`) ?? [];
    return totalCriteria > 0 && rows.length >= totalCriteria ? computeWeightedScore(rows, weights) : null;
  };

  // (위원:대상) → 종합의견 텍스트
  const opinionOf = new Map<string, string>();
  for (const o of opinions) if (o.text.trim()) opinionOf.set(`${o.evaluatorId}:${o.subjectId}`, o.text);

  // 위원장을 맨 앞에
  const chairId = session?.chairId ?? null;
  const evaluators = [...assignments]
    .sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))
    .map((a) => ({ id: a.userId, name: a.user.name, isChair: a.userId === chairId }));

  const subjectNameOf = new Map(subjects.map((s) => [s.id, s.name]));

  // 위원장 통합의견 — 대상(Subject.chairOpinion)마다 1건. 위원별 종합의견(Opinion)과는 별개다.
  const chairName = evaluators.find((ev) => ev.isChair)?.name ?? "";
  const items = subjects
    .filter((s) => (s.chairOpinion ?? "").trim())
    .map((s) => ({
      evaluatorId: chairId ?? s.id,
      evaluatorName: chairName,
      subjectId: s.id,
      subjectName: subjectNameOf.get(s.id) ?? "",
      text: s.chairOpinion ?? "",
    }))
    .filter((item) => item.subjectName);

  const locked = session?.status === "CLOSED";
  const os = (session?.opinionStatus ?? "DRAFT") as ReviewStatus;
  // 간사 제출(SUBMITTED) 이후에만 관리자가 의견서를 볼 수 있다.
  const adminCanView = os === "SUBMITTED" || os === "APPROVED";
  const adminBlocked = isMaster && !locked && !adminCanView;

  return (
    <div className="space-y-4">
      {/* 상단: 엑셀 내보내기(안내 문구는 제목 옆으로 이동) */}
      <div className="flex items-center justify-end gap-3 border-b border-slate-200 pb-2">
        <ExcelExportButton href={`/api/sessions/${id}/export/opinions`} />
      </div>

      {/* 간사 검토 상태 배너 — 간사: 검토 완료/취소, 관리자: 승인/반려. 의견서는 위원이 작성하고
          간사는 내용을 '검토'만 하므로 제출 대신 검토 표현을 쓴다(wording="review"). */}
      {!locked && (
        <ReviewWorkflowPanel
          sessionId={id}
          isMaster={isMaster}
          status={os}
          rejectionReason={session?.opinionRejectionReason ?? null}
          draftBadge="검토중"
          wording="review"
          onSubmit={submitOpinions}
          onCancelSubmit={cancelSubmitOpinions}
          onApprove={approveOpinions}
          onReject={rejectOpinions}
        />
      )}

      {adminBlocked ? null : evaluators.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-slate-400">
          배정된 평가위원이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {/* 위원장이 지정됐으면 이름을 앞에 붙여 표시 */}
          <h2 className="text-sm font-semibold text-slate-700">
            {chairName ? `${chairName} 평가위원장 통합의견` : "평가위원장 통합의견"}
          </h2>
          <OpinionViewer items={items} />
        </div>
      )}

      {/* 지원기업별 점수 — 전 항목을 입력한 위원들의 총점 평균 */}
      {!adminBlocked && subjects.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">지원기업별 점수</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">지원기업</th>
                  <th className="px-5 py-2.5 text-right font-medium">채점 완료 위원</th>
                  <th className="px-5 py-2.5 text-right font-medium">점수</th>
                  <th className="px-5 py-2.5 font-medium">자세히 보기</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const totals = evaluators
                    .map((ev) => totalOf(ev.id, s.id))
                    .filter((v): v is number => v !== null);
                  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null;
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2.5 text-slate-800">{s.name}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">
                        {totals.length}/{evaluators.length}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium tabular-nums text-slate-800">
                        {avg !== null ? avg.toFixed(2) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-2.5">
                        {/* 채점 완료 위원의 총점·종합의견을 모달로 확인(미완료 위원은 제외) */}
                        <SubjectScoresDetail
                          subjectName={s.name}
                          evaluators={evaluators.flatMap((ev) => {
                            const score = totalOf(ev.id, s.id);
                            if (score === null) return [];
                            return [{
                              name: ev.name,
                              isChair: ev.isChair,
                              score,
                              opinion: opinionOf.get(`${ev.id}:${s.id}`) ?? null,
                            }];
                          })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
