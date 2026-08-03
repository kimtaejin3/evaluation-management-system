'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resetEvaluatorPassword } from '@/app/admin/actions'

type ManagedUser = {
  id: string
  name: string
  username: string
  tempPassword: string | null
}

// 사용자(담당자·위원) 비밀번호 관리 — 표 밑 버튼으로 열리는 모달에서 임시 비밀번호를
// 조회(보기 토글)하고 재발급한다. 재발급은 resetEvaluatorPassword 서버 액션 + router.refresh.
// roleLabel로 '담당자'/'위원' 문구만 달라진다.
export default function UserPasswordManager({
  users,
  roleLabel = '담당자',
}: {
  users: ManagedUser[]
  roleLabel?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
      >
        비밀번호 재발급
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">비밀번호 관리</h3>
                <p className="mt-0.5 text-xs text-slate-400">{roleLabel}별 임시 비밀번호를 조회하거나 재발급합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="overflow-auto px-6 py-4">
              {users.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">{roleLabel}가 없습니다.</p>
              ) : (
                <table className="table-grid w-full text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">이름</th>
                      <th className="px-4 py-2.5 font-medium">아이디</th>
                      <th className="px-4 py-2.5 font-medium">비밀번호</th>
                      <th className="px-4 py-2.5 font-medium">재발급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <UserRow key={u.id} user={u} roleLabel={roleLabel} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UserRow({ user, roleLabel }: { user: ManagedUser; roleLabel: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [shown, setShown] = useState(false)

  const reissue = () => {
    if (!confirm(`${user.name} ${roleLabel}의 비밀번호를 재발급할까요? 기존 비밀번호는 더 이상 사용할 수 없습니다.`)) return
    start(async () => {
      await resetEvaluatorPassword(user.id)
      setShown(true)
      router.refresh()
    })
  }

  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-4 py-2.5 font-medium text-slate-800">{user.name}</td>
      <td className="px-4 py-2.5 text-slate-600">{user.username}</td>
      <td className="px-4 py-2.5">
        {user.tempPassword ? (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono tabular-nums text-slate-700">
              {shown ? user.tempPassword : '•'.repeat(Math.min(user.tempPassword.length, 10))}
            </span>
            <button
              type="button"
              onClick={() => setShown((v) => !v)}
              className="text-xs text-slate-400 transition hover:text-indigo-600"
            >
              {shown ? '숨기기' : '보기'}
            </button>
          </span>
        ) : (
          <span className="text-xs text-slate-400">미발급</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <button
          type="button"
          onClick={reissue}
          disabled={pending}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? '처리 중…' : '재발급'}
        </button>
      </td>
    </tr>
  )
}
