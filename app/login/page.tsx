'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [state, formAction] = useActionState(login, null)
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form action={formAction} className="w-80 space-y-4 rounded border bg-white p-8 shadow">
        <h1 className="text-xl font-bold">심사·평가 시스템</h1>
        <p className="text-sm text-gray-500">관리자 · 평가위원 로그인</p>
        <div>
          <label className="block text-sm">아이디</label>
          <input name="username" className="mt-1 w-full rounded border px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm">비밀번호</label>
          <input name="password" type="password" className="mt-1 w-full rounded border px-3 py-2" required />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="w-full rounded bg-gray-900 py-2 text-white">로그인</button>
      </form>
    </main>
  )
}
