import { prisma } from "@/lib/db";
import CompanyLogo from "@/components/CompanyLogo";
import {
  createCompany,
  deleteCompany,
  uploadCompanyDocument,
  deleteCompanyDocument,
} from "../actions";

const inputCls =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      _count: { select: { subjects: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">기업 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          평가 대상 기업과 자료를 전역으로 등록합니다. 자료는 여러 회차에서
          공유됩니다.
        </p>
      </div>

      {/* 신규 기업 등록 (상단) */}
      <form
        action={createCompany}
        className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="col-span-3 text-sm font-semibold text-slate-700">
          기업 등록
        </div>
        <input name="name" placeholder="기업명" required className={inputCls} />
        <input
          name="description"
          placeholder="설명(선택)"
          className={`col-span-2 ${inputCls}`}
        />
        <button className="col-span-3 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          + 기업 등록
        </button>
        <p className="col-span-3 text-xs text-slate-400">
          같은 기업명이면 기존 기업을 갱신합니다.
        </p>
      </form>

      <div className="space-y-3">
        {companies.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CompanyLogo name={c.name} className="h-6 w-6" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {c.name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      회차 {c._count.subjects}곳 사용
                    </span>
                  </div>
                  {c.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {c.description}
                    </p>
                  )}
                </div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await deleteCompany(c.id);
                }}
              >
                <button className="text-sm text-rose-600 hover:underline">
                  삭제
                </button>
              </form>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-medium text-slate-500">
                자료 ({c.documents.length})
              </div>
              <ul className="space-y-1">
                {c.documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                  >
                    <a
                      href={`/api/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-indigo-600 hover:underline"
                    >
                      <span>📄</span>
                      <span>{d.originalName}</span>
                      <span className="text-xs text-slate-400">
                        {formatSize(d.size)}
                      </span>
                    </a>
                    <form
                      action={async () => {
                        "use server";
                        await deleteCompanyDocument(d.id);
                      }}
                    >
                      <button className="text-xs text-rose-500 hover:underline">
                        삭제
                      </button>
                    </form>
                  </li>
                ))}
                {c.documents.length === 0 && (
                  <li className="text-sm text-slate-400">
                    등록된 자료가 없습니다.
                  </li>
                )}
              </ul>
              <form
                action={uploadCompanyDocument.bind(null, c.id)}
                className="mt-3 flex items-center gap-2"
              >
                <input
                  type="file"
                  name="file"
                  multiple
                  required
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200"
                />
                <button className="shrink-0 rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white transition hover:bg-slate-900">
                  일괄 업로드
                </button>
              </form>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            등록된 기업이 없습니다. 위에서 먼저 기업을 등록하세요.
          </div>
        )}
      </div>
    </div>
  );
}
