'use client'

import { useActionState, useEffect, useState } from 'react'
import { login } from './actions'

const SAVED_ID_KEY = 'login.savedUsername'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

type DemoAccount = { role: string; username?: string; password?: string; disabled?: boolean; note?: string }

// 데모 빠른 로그인 — 관리자·간사만 활성화. 평가위원은 분과 배정, 평가위원장은 간사가 동적으로 지정하므로 비활성.
const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: '관리자', username: 'admin', password: 'admin1234' },
  { role: '간사', username: 'gansa', password: 'gansa1234' },
  { role: '평가위원', disabled: true, note: '분과 배정 후' },
  { role: '평가위원장', disabled: true, note: '간사가 지정' },
]

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberId, setRememberId] = useState(false)

  // 재방문 시 저장된 아이디를 불러와 자동으로 채운다(브라우저 localStorage).
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_ID_KEY)
    if (saved) {
      setUsername(saved)
      setRememberId(true)
    }
  }, [])

  // 제출 직전 저장/삭제 — 체크 시 아이디 기억, 해제 시 삭제.
  const persistId = () => {
    if (rememberId && username.trim()) localStorage.setItem(SAVED_ID_KEY, username.trim())
    else localStorage.removeItem(SAVED_ID_KEY)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      {/* 헤더 + 카드를 한 블록으로 묶어 함께 세로 중앙 정렬(높이가 커져도 타이틀-카드 간격 유지) */}
      <div className="w-full max-w-4xl">
        {/* 상단 좌측 로고 */}
        <header className="mb-6">
          <div className="text-lg font-extrabold leading-none text-slate-900">
            심사·평가 <span className="font-semibold text-[var(--gov-navy)]">종합관리시스템</span>
          </div>
          <div className="mt-0.5 text-[10px] font-medium leading-none tracking-[0.15em] text-slate-400 uppercase">
            Evaluation Management System
          </div>
        </header>

        {/* 카드 */}
        <div className="grid w-full overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 md:grid-cols-2">
          {/* 좌: 일러스트 패널 */}
          <div className="relative hidden overflow-hidden bg-[var(--gov-navy)] p-8 md:block">
            {/* 배경 블롭 */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-sky-400/20" />
              <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-indigo-400/20" />
              <div className="absolute bottom-10 left-6 h-24 w-24 rounded-full bg-sky-300/10" />
            </div>

            {/* 담당자 배지 */}
            <span className="relative inline-flex rounded-lg bg-[var(--gov-primary)] px-5 py-2 text-sm font-bold text-white shadow-sm">
              담당자
            </span>

            {/* 일러스트(추상 UI 카드) */}
            <div className="relative mt-8 flex items-center justify-center">
              <SystemIllustration />
            </div>

            <div className="relative mt-6">
              <h2 className="text-xl font-bold leading-snug text-white">
                공정하고 투명한
                <br />
                심사·평가 운영
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                평가 실시 · 진행 모니터링 · 결과 집계를 한 곳에서
              </p>
            </div>
          </div>

          {/* 우: 로그인 폼 */}
          <div className="p-8 sm:p-10">
            <div className="mb-6 flex items-center gap-2">
              <LockIcon className="h-6 w-6 text-slate-700" />
              <h1 className="text-2xl font-bold text-slate-900">로그인</h1>
            </div>

            <form action={formAction} onSubmit={persistId} className="space-y-3">
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputCls}
                  required
                  autoFocus
                  placeholder="아이디"
                />
              </div>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  required
                  placeholder="비밀번호"
                />
              </div>

              {/* 아이디 저장 — 체크 시 브라우저(localStorage)에 아이디를 기억한다 */}
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberId}
                  onChange={(e) => setRememberId(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                아이디 저장
              </label>

              {state?.error && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                  {state.error}
                </p>
              )}

              <button
                disabled={isPending}
                aria-busy={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
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
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-medium text-slate-500">데모 계정</div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => {
                  const active = !a.disabled && username === a.username
                  return (
                    <button
                      key={a.role}
                      type="button"
                      disabled={a.disabled}
                      onClick={a.disabled ? undefined : () => { setUsername(a.username ?? ''); setPassword(a.password ?? '') }}
                      title={a.disabled ? a.note : undefined}
                      className={`rounded-md border px-3 py-1.5 text-left text-xs transition ${
                        a.disabled
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                          : active
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium">{a.role}</span>
                      <span className={`mt-0.5 block text-[11px] ${a.disabled ? 'text-slate-300' : 'text-slate-400'}`}>
                        {a.disabled ? a.note : a.username}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">계정을 누르면 아이디·비밀번호가 채워집니다.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19.5a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// 시스템을 상징하는 추상 UI 카드 일러스트(자체 SVG, 외부 자산 없음)
function SystemIllustration() {
  return (
    <svg viewBox="0 0 260 180" className="h-40 w-full max-w-[260px]" role="img" aria-label="평가 시스템 일러스트">
      {/* 채점 카드 */}
      <g>
        <rect x="18" y="34" width="130" height="120" rx="10" fill="#fff" />
        <rect x="34" y="52" width="70" height="9" rx="4.5" fill="#c7d2fe" />
        {[74, 92, 110, 128].map((y) => (
          <g key={y}>
            <rect x="34" y={y} width="64" height="7" rx="3.5" fill="#e2e8f0" />
            <circle cx="118" cy={y + 3.5} r="6" fill="#dbeafe" />
            <path d={`M115 ${y + 3.5} l2 2 4-4`} stroke="#2563eb" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>
      {/* 차트 카드 */}
      <g>
        <rect x="150" y="18" width="92" height="72" rx="10" fill="#eff6ff" />
        <rect x="164" y="70" width="10" height="8" rx="2" fill="#60a5fa" />
        <rect x="180" y="60" width="10" height="18" rx="2" fill="#3b82f6" />
        <rect x="196" y="48" width="10" height="30" rx="2" fill="#2563eb" />
        <rect x="212" y="38" width="10" height="40" rx="2" fill="#1d4ed8" />
        <path d="M164 58 l16 -8 16 -10 16 -8" stroke="#93c5fd" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* 말풍선 */}
      <g>
        <rect x="158" y="104" width="84" height="50" rx="10" fill="#fff" />
        <path d="M176 154 l0 12 12 -12 z" fill="#fff" />
        <rect x="170" y="118" width="60" height="6" rx="3" fill="#cbd5e1" />
        <rect x="170" y="130" width="44" height="6" rx="3" fill="#e2e8f0" />
      </g>
    </svg>
  )
}
