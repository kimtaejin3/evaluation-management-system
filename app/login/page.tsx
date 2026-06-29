'use client'

import { useActionState, useState } from 'react'
import { login } from './actions'
import BrandMark from '@/components/BrandMark'

const inputCls = 'mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

const POINTS = ['분과 항목 설정 · 평가 · 결과 집계를 한 곳에서', '위원별 진행 현황 실시간 모니터링', '평가 자료 일괄 업로드 및 권한 보호']

const DEMO_ACCOUNTS = [
  { role: '관리자', name: '관리자', username: 'admin', password: 'admin1234' },
  { role: '평가위원', name: '김평가', username: 'kim', password: 'eval1234' },
  { role: '평가위원', name: '이심사', username: 'lee', password: 'eval1234' },
]

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  return (
    <main className="flex min-h-screen bg-slate-100">
      {/* 좌측 브랜드 패널 */}
      <aside className="relative hidden w-1/2 flex-col justify-between bg-[var(--gov-navy)] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <div>
            <div className="text-base font-bold leading-tight">사업 심사·평가</div>
            <div className="text-xs text-slate-300">종합관리시스템</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-snug">
            공정하고 투명한
            <br />
            심사·평가 운영
          </h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-slate-200">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden>
                  <path d="m4 10 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">ⓒ 사업 심사·평가 종합관리시스템</p>
      </aside>

      {/* 우측 로그인 폼 */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark variant="solid" className="mb-3 h-12 w-12" />
            <h1 className="text-xl font-bold text-slate-900">사업 심사·평가 시스템</h1>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">로그인</h1>
          <p className="mt-1.5 text-sm text-slate-500">관리자 · 평가위원 계정으로 로그인하세요.</p>

          <form action={formAction} className="mt-7 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">아이디</label>
              <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} required autoFocus placeholder="아이디 입력" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">비밀번호</label>
              <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} required placeholder="비밀번호 입력" />
            </div>
            {state?.error && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>
            )}
            <button
              disabled={isPending}
              aria-busy={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending && (
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {isPending ? '로그인 중…' : '로그인'}
            </button>
          </form>

          {/* 데모 계정 빠른 선택 */}
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-medium text-slate-500">데모 계정</div>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((a) => {
                const active = username === a.username
                return (
                  <button
                    key={a.username}
                    type="button"
                    onClick={() => { setUsername(a.username); setPassword(a.password) }}
                    className={`rounded-md border px-3 py-1.5 text-left text-xs transition ${
                      active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium">{a.name}</span>
                    <span className="ml-1 text-slate-400">{a.role}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{a.username}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">계정을 누르면 아이디·비밀번호가 채워집니다. 그 후 로그인을 누르세요.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
