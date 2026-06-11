import Link from 'next/link'
import { createSession } from '../actions'

const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default function NewSessionPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-600">← 대시보드</Link>
        <h1 className="mt-1 text-2xl font-bold">새 회차</h1>
      </div>
      <form action={createSession} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">회차명 *</label>
          <input name="name" required className={inputCls} placeholder="예) 2026년 상반기 사업 평가" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">설명</label>
          <textarea name="description" rows={3} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">일시</label>
            <input name="eventDate" type="datetime-local" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">장소</label>
            <input name="location" className={inputCls} />
          </div>
        </div>
        <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          회차 생성
        </button>
      </form>
    </div>
  )
}
