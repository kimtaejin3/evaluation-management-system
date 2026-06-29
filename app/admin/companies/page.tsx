import { Suspense } from "react";
import { prisma } from "@/lib/db";
import CompanyLogo from "@/components/CompanyLogo";
import { createCompany, deleteCompany } from "../actions";
import { SkeletonCardGrid } from "@/components/Skeletons";

const inputCls =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "초안", cls: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "진행중", cls: "bg-indigo-50 text-indigo-700" },
  CLOSED: { label: "마감", cls: "bg-slate-200 text-slate-600" },
};

export default function CompaniesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">기업 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          평가 대상 기업을 등록·관리합니다. 분과 자료 업로드는 <span className="font-medium text-slate-600">분과 관리 &gt; 평가 대상</span>에서 합니다.
        </p>
      </div>

      {/* 신규 기업 등록 (상단) */}
      <form
        action={createCompany}
        className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="col-span-2 text-sm font-semibold text-slate-700">기업 등록</div>
        <input name="name" placeholder="기업명" required className={inputCls} />
        <input name="businessNo" placeholder="사업자등록번호 (예: 123-45-67890)" className={inputCls} />
        <input name="description" placeholder="설명(선택)" className={`col-span-2 ${inputCls}`} />
        <button className="col-span-2 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          + 기업 등록
        </button>
        <p className="col-span-2 text-xs text-slate-400">같은 기업명이면 기존 기업을 갱신합니다.</p>
      </form>

      <Suspense fallback={<SkeletonCardGrid count={3} lines={2} cols="" />}>
        <CompanyList />
      </Suspense>
    </div>
  );
}

async function CompanyList() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      subjects: { select: { session: { select: { id: true, name: true, status: true } } } },
    },
  });

  return (
    <div className="space-y-3">
        {companies.map((c) => {
          // 이 기업이 참여 중인 분과(중복 제거)
          const sessions = Array.from(
            new Map(c.subjects.map((s) => [s.session.id, s.session])).values(),
          );
          return (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <CompanyLogo name={c.name} className="h-6 w-6" />
                  <div>
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <div className="mt-0.5 text-xs text-slate-500">
                      사업자등록번호 <span className="font-medium text-slate-700">{c.businessNo || "—"}</span>
                    </div>
                    {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
                  </div>
                </div>
                <form action={async () => { "use server"; await deleteCompany(c.id); }}>
                  <button className="text-sm text-rose-600 hover:underline">삭제</button>
                </form>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-2 text-xs font-medium text-slate-500">참여 분과 ({sessions.length})</div>
                {sessions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sessions.map((s) => {
                      const st = STATUS[s.status] ?? { label: s.status, cls: "bg-slate-100 text-slate-600" };
                      return (
                        <span key={s.id} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700">
                          {s.name}
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">참여 중인 분과가 없습니다.</p>
                )}
              </div>
            </div>
          );
        })}
        {companies.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            등록된 기업이 없습니다. 위에서 먼저 기업을 등록하세요.
          </div>
        )}
    </div>
  );
}
