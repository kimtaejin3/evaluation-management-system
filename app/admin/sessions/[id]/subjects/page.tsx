import { Suspense } from "react";
import { prisma } from "@/lib/db";
import CompanyLogo from "@/components/CompanyLogo";
import {
  addSubject,
  editSubject,
  deleteSubject,
  uploadSubjectDocument,
  deleteSubjectDocument,
  submitSubjectReview,
  cancelSubmitSubjectReview,
  approveSubjectReview,
  rejectSubjectReview,
} from "../../actions";
import SubjectUploadForm from "@/components/SubjectUploadForm";
import ExcelExportButton from "@/components/ExcelExportButton";
import ExcelImportButton from "@/components/ExcelImportButton";
import ReviewWorkflowPanel, { type ReviewStatus } from "@/components/ReviewWorkflowPanel";
import { SkeletonCard, SkeletonCardGrid } from "@/components/Skeletons";
import { requireAdminUser } from "@/lib/authz";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

type SubjectStatus = "PENDING" | "APPROVED" | "REJECTED";

const STATUS_LABEL: Record<SubjectStatus, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

const STATUS_BADGE_CLS: Record<SubjectStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-600",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function SubjectsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonCard lines={2} />
          <SkeletonCardGrid count={3} lines={3} cols="" />
        </div>
      }
    >
      <SubjectsContent id={id} />
    </Suspense>
  );
}

async function SubjectsContent({ id }: { id: string }) {
  const me = await requireAdminUser();
  const isMaster = me.role === "MASTER";
  const [session, subjects] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.subject.findMany({
      where: { sessionId: id },
      orderBy: { order: "asc" },
      // 이 분과 전용 자료 + 공통(sessionId=null) 자료만
      include: {
        company: {
          include: {
            documents: {
              where: { OR: [{ sessionId: id }, { sessionId: null }] },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
  ]);
  const locked = session?.status === "CLOSED";
  const sr = (session?.subjectReviewStatus ?? "DRAFT") as ReviewStatus;
  // 간사 제출(SUBMITTED) 이후에만 관리자가 평가 대상을 볼 수 있다.
  const adminCanView = sr === "SUBMITTED" || sr === "APPROVED";
  // 추가·수정·삭제·업로드는 담당 간사만, 제출 전(DRAFT/REJECTED)에만.
  const canEdit = !locked && !isMaster && (sr === "DRAFT" || sr === "REJECTED");
  const adminBlocked = isMaster && !locked && !adminCanView;

  return (
    <div className="space-y-6">
      {/* 상단: 제목 + 엑셀 내보내기(역할·상태 무관 고정) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="text-sm font-semibold text-slate-700">
          평가 대상 <span className="ml-0.5 text-xs text-slate-400">{subjects.length}개</span>
        </h2>
        <ExcelExportButton href={`/api/sessions/${id}/export/subjects`} />
      </div>

      {/* 검토 워크플로 배너 — 간사: 제출/취소, 관리자: 승인/반려 */}
      {!locked && (
        <ReviewWorkflowPanel
          sessionId={id}
          isMaster={isMaster}
          status={sr}
          rejectionReason={session?.subjectReviewRejectionReason ?? null}
          draftBadge="작성중"
          onSubmit={submitSubjectReview}
          onCancelSubmit={cancelSubmitSubjectReview}
          onApprove={approveSubjectReview}
          onReject={rejectSubjectReview}
        />
      )}

      {/* 대상 추가 (상단, 간사 전용, 제출 전) */}
      {locked ? (
        <p className="text-sm text-slate-400">
          마감된 분과는 평가 대상을 수정할 수 없습니다.
        </p>
      ) : isMaster ? null : !canEdit ? (
        <p className="text-sm text-slate-400">
          제출 완료 상태에서는 평가 대상을 수정할 수 없습니다. 수정하려면 상단에서 제출을 취소하세요.
        </p>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-700">
              평가 대상 추가
            </div>
            <ExcelImportButton scopeId={id} kind="subjects" />
          </div>

          {/* 신규 평가 대상(기업) 등록 → 이 분과에 바로 편입 */}
          <form
            action={addSubject.bind(null, id)}
            className="flex flex-wrap gap-2"
          >
            <input name="newName" required placeholder="새 기업명" className={`min-w-40 flex-1 ${inputCls}`} />
            <input name="region" required placeholder="지역" className={`w-28 ${inputCls}`} />
            <input name="leadResearcher" required placeholder="연구책임자" className={`w-32 ${inputCls}`} />
            <input name="businessNo" placeholder="사업자등록번호" className={`w-40 ${inputCls}`} />
            <button className="shrink-0 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50">
              신규 등록
            </button>
          </form>

          <p className="text-xs text-slate-400">
            지역·연구책임자는 인쇄 평가표 헤더에 사용됩니다. 등록된 평가 대상은 관리자 승인 후 확정됩니다.
          </p>
        </div>
      )}

      {/* 대상 탭(빠른 이동) — 관리자는 제출 후에만 */}
      {!adminBlocked && subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s, i) => (
            <a
              key={s.id}
              href={`#subject-${s.id}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <span className="mr-1 text-slate-400">{i + 1}</span>
              {s.name}
            </a>
          ))}
        </div>
      )}

      {!adminBlocked && subjects.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          편입된 평가 대상이 없습니다.{" "}
          {canEdit && "위에서 기업을 추가하세요."}
        </div>
      )}

      <div className="space-y-4">
        {!adminBlocked && subjects.map((s, i) => {
          const status = s.status as SubjectStatus;
          return (
            <div
              key={s.id}
              id={`subject-${s.id}`}
              className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <CompanyLogo name={s.name} className="h-9 w-9 text-sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {s.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLS[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      사업자번호{" "}
                      {s.company.businessNo ?? (
                        <span className="text-slate-300">미등록</span>
                      )}
                      {" · 지역 "}
                      {s.company.region ?? <span className="text-slate-300">미등록</span>}
                      {" · 연구책임자 "}
                      {s.company.leadResearcher ?? <span className="text-slate-300">미등록</span>}
                    </p>
                    {s.company.description && (
                      <p className="mt-1 text-sm text-slate-500">
                        {s.company.description}
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <form
                    action={async () => {
                      "use server";
                      await deleteSubject(id, s.id);
                    }}
                  >
                    <button className="text-sm text-rose-600 hover:underline">
                      분과에서 제외
                    </button>
                  </form>
                )}
              </div>

              {/* 반려 사유 배너 + 간사 수정 폼 */}
              {status === "REJECTED" && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-medium text-rose-700">
                    관리자 반려 사유
                  </p>
                  <p className="mt-1 text-sm text-rose-600">
                    {s.rejectionReason || "사유가 입력되지 않았습니다."}
                  </p>
                  {canEdit && (
                    <form
                      action={editSubject.bind(null, id, s.id)}
                      className="mt-3 flex flex-wrap gap-2 border-t border-rose-100 pt-3"
                    >
                      <input
                        name="region"
                        required
                        defaultValue={s.company.region ?? ""}
                        placeholder="지역"
                        className={`w-28 ${inputCls}`}
                      />
                      <input
                        name="leadResearcher"
                        required
                        defaultValue={s.company.leadResearcher ?? ""}
                        placeholder="연구책임자"
                        className={`w-32 ${inputCls}`}
                      />
                      <input
                        name="businessNo"
                        defaultValue={s.company.businessNo ?? ""}
                        placeholder="사업자등록번호"
                        className={`w-40 ${inputCls}`}
                      />
                      <button className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700">
                        수정 후 재검토 요청
                      </button>
                    </form>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    분과 서류 ({s.company.documents.length})
                  </span>
                </div>
                <ul className="space-y-1">
                  {s.company.documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <a
                        href={`/viewer/${d.id}`}
                        className="flex items-center gap-2 text-indigo-600 hover:underline"
                      >
                        <span>📄</span>
                        <span>{d.originalName}</span>
                        <span className="text-xs text-slate-400">
                          {formatSize(d.size)}
                        </span>
                      </a>
                      {canEdit && (
                        <form
                          action={async () => {
                            "use server";
                            await deleteSubjectDocument(id, d.id);
                          }}
                        >
                          <button className="ml-2 shrink-0 text-xs text-rose-600 hover:underline">
                            삭제
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                  {s.company.documents.length === 0 && (
                    <li className="text-sm text-slate-400">
                      등록된 자료가 없습니다.
                      {!isMaster && !locked && " 아래에서 업로드하세요."}
                    </li>
                  )}
                </ul>

                {canEdit && (
                  <SubjectUploadForm
                    action={uploadSubjectDocument.bind(null, id, s.companyId)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
