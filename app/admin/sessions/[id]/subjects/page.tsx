import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { addSubject } from "../../actions";
import ExcelExportButton from "@/components/ExcelExportButton";
import ExcelImportButton from "@/components/ExcelImportButton";
import SubjectsTable, { type SubjectRow } from "@/components/SubjectsTable";
import { SkeletonCard, SkeletonCardGrid } from "@/components/Skeletons";
import { requireAdminUser } from "@/lib/authz";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

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
  await requireAdminUser();
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
  // 제출/검토 흐름 제거 — 마감 전이면 관리자·담당자 모두 추가·수정·삭제·업로드 가능
  const canEdit = !locked;

  return (
    <div className="space-y-6">
      {/* 상단: 제목 + 내보내기/가져오기(내보내기는 항상, 가져오기는 담당자 편집 가능 시 — 위치 통일) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="text-sm font-semibold text-slate-700">
          평가 대상 <span className="ml-0.5 text-xs text-slate-400">{subjects.length}개</span>
        </h2>
        <div className="flex items-center gap-2">
          <ExcelExportButton href={`/api/sessions/${id}/export/subjects`} />
          {canEdit && (
            <>
              <ExcelExportButton href="/api/subjects-template" label="양식 다운로드" />
              <ExcelImportButton scopeId={id} kind="subjects" />
            </>
          )}
        </div>
      </div>
      {canEdit && (
        <p className="-mt-4 text-right text-xs text-slate-400">
          한글(HWP)은 이 엑셀 양식을 한글에서 열어 표를 채운 뒤, 표를 복사해 ‘가져오기’ 창에 붙여넣으세요. (한글 파일 업로드는 지원하지 않습니다)
        </p>
      )}

      {/* 대상 추가 (상단) — 관리자·담당자 공통 */}
      {locked ? (
        <p className="text-sm text-slate-400">
          마감된 분과는 평가 대상을 수정할 수 없습니다.
        </p>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-700">
            평가 대상 추가
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

          <p className="text-xs text-slate-400">지역·연구책임자는 인쇄 평가표 헤더에 사용됩니다.</p>
        </div>
      )}

      {/* 평가 대상 목록 — 테이블 UI(수정/서류 관리는 모달). 관리자·담당자 공통 편집. */}
      <SubjectsTable
          sessionId={id}
          canEdit={canEdit}
          canManageDocs={canEdit}
          subjects={subjects.map(
            (s): SubjectRow => ({
              id: s.id,
              companyId: s.companyId,
              name: s.name,
              status: s.status as SubjectRow["status"],
              rejectionReason: s.rejectionReason,
              businessNo: s.company.businessNo,
              region: s.company.region,
              leadResearcher: s.company.leadResearcher,
              description: s.company.description,
              documents: s.company.documents.map((d) => ({ id: d.id, originalName: d.originalName, size: d.size })),
            }),
          )}
        />
    </div>
  );
}
