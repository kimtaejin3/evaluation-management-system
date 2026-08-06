import Link from "next/link";
import { assertMaster } from "@/lib/authz";
import { createProject } from "../actions";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default async function NewProjectPage() {
  await assertMaster();
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/admin/projects" className="text-sm text-slate-400 hover:text-slate-600">
        ← 사업 목록
      </Link>
      <h1 className="mt-1 text-2xl font-bold">사업 등록</h1>
      <form action={createProject} className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <label className="text-sm font-medium text-slate-700">사업명</label>
          <input name="name" required className={inputCls} placeholder="예) 2026년 상반기 R&D 지원사업" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">시작일</label>
            <input name="startDate" type="date" required className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">종료일</label>
            <input name="endDate" type="date" required className={inputCls} />
          </div>
        </div>
        <button className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          사업 생성
        </button>
      </form>
    </div>
  );
}
