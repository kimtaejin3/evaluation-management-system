'use client'

import { useActionState } from 'react'
import { login } from './actions'
import BrandMark from '@/components/BrandMark'

const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default function LoginPage() {
  const [state, formAction] = useActionState(login, null)
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandMark variant="solid" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-xl font-bold text-slate-900">심사·평가 시스템</h1>
          <p className="mt-1 text-sm text-slate-500">관리자 · 평가위원 로그인</p>
        </div>
        <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8">
          <div>
            <label className="block text-sm font-medium text-slate-700">아이디</label>
            <input name="username" className={inputCls} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">비밀번호</label>
            <input name="password" type="password" className={inputCls} required />
          </div>
          {state?.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>
          )}
          <button className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">
            로그인
          </button>
        </form>
      </div>
    </main>
  )
}
