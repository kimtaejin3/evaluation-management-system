import Link from 'next/link'
import { createSession } from '../actions'

const labelCls = 'block text-sm font-medium text-slate-700'
const inputCls = 'mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default function NewSessionPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/admin/sessions" className="text-sm text-slate-400 hover:text-slate-600">← 심사 목록</Link>
      <h1 className="mt-1 text-2xl font-bold">새 심사 등록</h1>
      <p className="mt-1 text-sm text-slate-500">평가를 진행할 심사의 기본 정보를 입력합니다.</p>

      <form action={createSession} className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="space-y-4 p-5">
          <div>
            <label className={labelCls}>심사명 <span className="text-rose-500">*</span></label>
            <input name="name" required className={inputCls} placeholder="예) 2026년 상반기 사업 평가" />
          </div>
          <div>
            <label className={labelCls}>설명</label>
            <textarea name="description" rows={2} className={`${inputCls} resize-none`} placeholder="심사에 대한 간단한 설명(선택)" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>일시</label>
              <input name="eventDate" type="datetime-local" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>장소</label>
              <input name="location" className={inputCls} placeholder="예) 본관 3층 회의실" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Link href="/admin/sessions" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">취소</Link>
          <button className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">심사 생성</button>
        </div>
      </form>
    </div>
  )
}
