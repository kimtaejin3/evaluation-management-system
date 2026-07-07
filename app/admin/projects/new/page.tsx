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
        ← 과제 목록
      </Link>
      <h1 className="mt-1 text-2xl font-bold">새 과제 등록</h1>
      <form action={createProject} className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <label className="text-sm font-medium text-slate-700">과제명</label>
          <input name="name" required className={inputCls} placeholder="예) 2026년 상반기 R&D 지원사업" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">과제 개요</label>
          <textarea name="description" rows={2} required className={`${inputCls} resize-none`} placeholder="예) 사업 목적·범위, 주요 평가 관점 등 과제 개요를 입력하세요" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">평가일</label>
          <input name="dueDate" type="datetime-local" required className={inputCls} />
        </div>
        <button className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          과제 생성
        </button>
      </form>
    </div>
  );
}
