'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UserPasswordManager from './UserPasswordManager'

export type ManagedUser = {
  id: string
  name: string
  username: string
  phone: string | null
  employeeNo: string | null
  tempPassword: string | null
  chips: { label: string; href?: string }[]
}

// 담당자·평가위원 관리 공통 표 — 평소엔 깔끔하게 보이다가 '{roleLabel} 삭제'를 누르면 선택 모드로 전환된다.
// 선택 모드에서는 각 행에 체크박스가 나타나고(행 클릭으로도 토글), '선택 삭제'로 한 번에 삭제한다.
// 비밀번호 조회·재발급은 옆의 모달 버튼(UserPasswordManager)에서. 삭제 액션은 페이지가 주입한다.
export default function UserManagerTable({
  users,
  roleLabel,
  chipsHeader,
  chipsEmptyLabel,
  showEmployeeNo = false,
  emptyLabel,
  deleteAction,
}: {
  users: ManagedUser[]
  roleLabel: string
  chipsHeader: string
  chipsEmptyLabel: string
  showEmployeeNo?: boolean
  emptyLabel: string
  deleteAction: (ids: string[]) => Promise<void>
}) {
  const router = useRouter()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const enterSelect = () => {
    setSelected(new Set())
    setSelecting(true)
  }
  const cancel = () => {
    setSelected(new Set())
    setSelecting(false)
  }

  const bulkDelete = () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${roleLabel} ${selected.size}명을 삭제할까요? 삭제하면 계정과 관련 정보가 모두 제거됩니다.`)) return
    start(async () => {
      await deleteAction([...selected])
      setSelected(new Set())
      setSelecting(false)
      router.refresh()
    })
  }

  // 열 수 = 이름/아이디/연락처 + (사번) + chips + (선택 체크박스)
  const cols = 4 + (showEmployeeNo ? 1 : 0) + (selecting ? 1 : 0)

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {selecting && <th className="w-12 px-4 py-2.5" />}
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">아이디</th>
              <th className="px-4 py-2.5 font-medium">연락처</th>
              {showEmployeeNo && <th className="px-4 py-2.5 font-medium">사번</th>}
              <th className="px-4 py-2.5 font-medium">{chipsHeader}</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-10 text-center text-slate-400">
                  {emptyLabel}
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={selecting ? () => toggle(u.id) : undefined}
                className={`border-b border-slate-50 transition last:border-0 ${
                  selecting
                    ? selected.has(u.id)
                      ? 'cursor-pointer bg-indigo-50'
                      : 'cursor-pointer hover:bg-slate-50/60'
                    : ''
                }`}
              >
                {selecting && (
                  <td className="px-4 py-2.5">
                    <PrettyCheck checked={selected.has(u.id)} />
                  </td>
                )}
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.username}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.phone ?? <span className="text-slate-300">—</span>}</td>
                {showEmployeeNo && (
                  <td className="px-4 py-2.5 text-slate-600">{u.employeeNo ?? <span className="text-slate-300">—</span>}</td>
                )}
                <td className="px-4 py-2.5">
                  {u.chips.length === 0 ? (
                    <span className="text-xs text-slate-400">{chipsEmptyLabel}</span>
                  ) : (
                    <span className="flex flex-wrap justify-center gap-1">
                      {u.chips.map((c, i) =>
                        c.href ? (
                          <Link
                            key={i}
                            href={c.href}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            {c.label}
                          </Link>
                        ) : (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {c.label}
                          </span>
                        ),
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 표 밑(카드 밖) 오른쪽: 평소엔 비밀번호 재발급 + {roleLabel} 삭제, 선택 모드에선 취소 + 선택 삭제 */}
      <div className="flex justify-end gap-2">
        {selecting ? (
          <>
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              disabled={selected.size === 0 || pending}
              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-100 disabled:border-slate-300 disabled:bg-white disabled:text-slate-400 disabled:opacity-60"
            >
              {pending ? '삭제 중…' : selected.size > 0 ? `선택 삭제 (${selected.size})` : '선택 삭제'}
            </button>
          </>
        ) : (
          <>
            <UserPasswordManager
              roleLabel={roleLabel}
              users={users.map((u) => ({
                id: u.id,
                name: u.name,
                username: u.username,
                tempPassword: u.tempPassword,
              }))}
            />
            <button
              type="button"
              onClick={enterSelect}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50"
            >
              {roleLabel} 삭제
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// 예쁜 체크박스 — 선택 상태에 따라 남색 배경 + 흰 체크. 행 클릭으로 토글되므로 시각 표시용.
function PrettyCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition ${
        checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
      }`}
      aria-hidden
    >
      {checked && (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 10 3.5 3.5L15 6" />
        </svg>
      )}
    </span>
  )
}
