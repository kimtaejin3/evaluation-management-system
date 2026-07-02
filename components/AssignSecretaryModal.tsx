'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  assignSecretaryToSession,
  createSecretaryAndAssignToSession,
} from '@/app/admin/projects/actions'

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

type SessionOpt = { id: string; name: string }
type SecretaryOpt = { id: string; name: string; username: string }

export default function AssignSecretaryModal({
  projectId,
  sessions,
  secretaries,
}: {
  projectId: string
  sessions: SessionOpt[]
  secretaries: SecretaryOpt[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [pending, start] = useTransition()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const noSessions = sessions.length === 0

  const runAssign = (formData: FormData) => {
    start(async () => {
      await assignSecretaryToSession(projectId, formData)
      setOpen(false)
      router.refresh()
    })
  }
  const runCreate = (formData: FormData) => {
    start(async () => {
      await createSecretaryAndAssignToSession(projectId, formData)
      setOpen(false)
      router.refresh()
    })
  }

  const tabCls = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 font-medium transition ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
      >
        간사 배정
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">간사 배정</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 transition hover:text-slate-600">
                ✕
              </button>
            </div>

            {noSessions ? (
              <p className="mt-4 text-sm text-slate-500">먼저 분과를 추가한 뒤 간사를 배정하세요.</p>
            ) : (
              <>
                <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                  <button type="button" onClick={() => setMode('existing')} className={tabCls(mode === 'existing')}>
                    기존 간사
                  </button>
                  <button type="button" onClick={() => setMode('new')} className={tabCls(mode === 'new')}>
                    새 간사 생성
                  </button>
                </div>

                {mode === 'existing' ? (
                  <form action={runAssign} className="mt-4 space-y-3">
                    <select name="sessionId" required defaultValue="" className={`w-full ${inputCls}`}>
                      <option value="" disabled>대상 분과</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select name="userId" required defaultValue="" className={`w-full ${inputCls}`}>
                      <option value="" disabled>기존 간사 선택</option>
                      {secretaries.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} · {s.username}</option>
                      ))}
                    </select>
                    {secretaries.length === 0 && (
                      <p className="text-xs text-slate-400">등록된 간사가 없습니다. ‘새 간사 생성’ 탭을 이용하세요.</p>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                        취소
                      </button>
                      <button disabled={pending || secretaries.length === 0} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
                        {pending ? '배정 중…' : '배정'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form action={runCreate} className="mt-4 grid grid-cols-2 gap-3">
                    <select name="sessionId" required defaultValue="" className={`col-span-2 ${inputCls}`}>
                      <option value="" disabled>대상 분과</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <input name="name" placeholder="이름" required className={inputCls} />
                    <input name="username" placeholder="아이디" required className={inputCls} />
                    <input name="phone" placeholder="연락처 (예: 010-1234-5678)" required className={`col-span-2 ${inputCls}`} />
                    <p className="col-span-2 text-xs text-slate-400">비밀번호는 연락처 끝 4자리로 발급됩니다.</p>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                        취소
                      </button>
                      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
                        {pending ? '생성 중…' : '생성·배정'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
