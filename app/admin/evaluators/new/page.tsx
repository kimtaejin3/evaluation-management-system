import Link from 'next/link'
import { assertMaster } from '@/lib/authz'
import { createEvaluator } from '../../actions'

const labelCls = 'block text-sm font-medium text-slate-700'
const inputCls =
  'mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

// 새 평가위원 등록 — 간사 추가처럼 전용 페이지. 생성 후 평가위원 관리로 복귀.
export default async function NewEvaluatorPage() {
  await assertMaster()

  return (
    <div className="max-w-2xl">
      <Link href="/admin/evaluators" className="text-sm text-slate-400 hover:text-slate-600">
        ← 평가위원 관리
      </Link>
      <h1 className="mt-1 text-2xl font-bold">새 평가위원 등록</h1>
      <p className="mt-1 text-sm text-slate-500">
        평가위원 계정을 만듭니다. 비밀번호는 연락처 끝 4자리로 발급되며, 기존 아이디면 정보를 갱신합니다.
      </p>

      <form action={createEvaluator} className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="space-y-4 p-5">
          <input type="hidden" name="role" value="EVALUATOR" />
          <div>
            <label className={labelCls}>
              이름 <span className="text-rose-500">*</span>
            </label>
            <input name="name" required className={inputCls} placeholder="예) 김평가" />
          </div>
          <div>
            <label className={labelCls}>
              아이디 <span className="text-rose-500">*</span>
            </label>
            <input name="username" required className={inputCls} placeholder="예) evaluator1" />
          </div>
          <div>
            <label className={labelCls}>
              연락처 <span className="text-rose-500">*</span>
            </label>
            <input name="phone" required className={inputCls} placeholder="예) 010-1234-5678" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Link
            href="/admin/evaluators"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            취소
          </Link>
          <button className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
            생성
          </button>
        </div>
      </form>
    </div>
  )
}
