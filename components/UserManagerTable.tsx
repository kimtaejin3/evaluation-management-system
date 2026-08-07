'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type ManagedUser = {
  id: string
  name: string
  username: string
  phone: string | null
  tempPassword: string | null
  affiliation?: string | null
  position?: string | null
  chips: { label: string; href?: string }[]
  // 두 번째 칩 열(예: 담당자 참여 분과) — chips2Header가 있을 때만 렌더
  chips2?: { label: string; href?: string }[]
  // 현재 배정된 분과 id 목록 — '정보 변경' 모달의 분과 배정 체크박스 초기값
  assignedSessionIds?: string[]
}

// 담당자·평가위원 관리 공통 표.
// - 체크박스를 항상 노출(상시 선택 가능). 머리글 체크박스로 전체 선택.
// - 표 아래 오른쪽의 '{roleLabel} 정보 변경' 하나로 수정·비밀번호 재발급·삭제를 모두 처리.
//   · 1명 선택: 정보 수정 폼 + 재발급 + 삭제
//   · 2명 이상: 일괄 삭제만
export default function UserManagerTable({
  users,
  roleLabel,
  chipsHeader,
  chipsEmptyLabel,
  emptyLabel,
  deleteAction,
  updateAction,
  resetPasswordAction,
  showAffiliation = false,
  showPassword = false,
  chips2Header,
  chips2EmptyLabel = '없음',
  sessionOptions,
  setSessionsAction,
}: {
  users: ManagedUser[]
  roleLabel: string
  chipsHeader: string
  chipsEmptyLabel: string
  emptyLabel: string
  deleteAction: (ids: string[]) => Promise<void>
  updateAction: (id: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>
  resetPasswordAction: (id: string) => Promise<{ ok: boolean; password?: string }>
  showAffiliation?: boolean
  // 아이디 옆 비밀번호 열(임시 비밀번호 평문 표시) — 담당자 관리용
  showPassword?: boolean
  // 두 번째 칩 열 머리글(예: '참여 중인 분과'). 있을 때만 열 렌더
  chips2Header?: string
  chips2EmptyLabel?: string
  // 분과 배정(관리자 전용) — 둘 다 있으면 '정보 변경' 모달(1명 선택)에서 분과 배정 체크박스 노출
  sessionOptions?: { id: string; label: string; group?: string }[]
  // 한 사용자의 분과 배정을 한 번에 설정(체크된 분과 = 배정)
  setSessionsAction?: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  // 칩 셀의 '설정'으로 여는 개별 분과 배정 모달 대상 사용자
  const [assignUser, setAssignUser] = useState<ManagedUser | null>(null)
  const canAssign = !!(sessionOptions && setSessionsAction)

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allChecked = users.length > 0 && selected.size === users.length
  const toggleAll = () =>
    setSelected((prev) => (prev.size === users.length ? new Set() : new Set(users.map((u) => u.id))))

  const selectedUsers = users.filter((u) => selected.has(u.id))
  // 이름/아이디/연락처 + (비밀번호) + (소속/직급) + chips + (chips2) + 체크박스
  const cols = 4 + (showPassword ? 1 : 0) + (showAffiliation ? 2 : 0) + (chips2Header ? 1 : 0) + 1

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="w-12 px-4 py-2.5">
                <button type="button" onClick={toggleAll} aria-label="전체 선택">
                  <PrettyCheck checked={allChecked} />
                </button>
              </th>
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">아이디</th>
              {showPassword && <th className="px-4 py-2.5 font-medium">비밀번호</th>}
              <th className="px-4 py-2.5 font-medium">연락처</th>
              {showAffiliation && <th className="px-4 py-2.5 font-medium">소속</th>}
              {showAffiliation && <th className="px-4 py-2.5 font-medium">직급</th>}
              <th className="px-4 py-2.5 font-medium">{chipsHeader}</th>
              {chips2Header && <th className="px-4 py-2.5 font-medium">{chips2Header}</th>}
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
                onClick={() => toggle(u.id)}
                className={`cursor-pointer border-b border-slate-50 transition last:border-0 ${
                  selected.has(u.id) ? 'bg-indigo-50' : 'hover:bg-slate-50/60'
                }`}
              >
                <td className="px-4 py-2.5">
                  <PrettyCheck checked={selected.has(u.id)} />
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.username}</td>
                {showPassword && (
                  <td className="px-4 py-2.5">
                    {u.tempPassword ? (
                      <span className="font-mono text-sm tabular-nums text-slate-700">{u.tempPassword}</span>
                    ) : (
                      <span className="text-xs text-slate-400">재발급 필요</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-2.5 text-slate-600">{u.phone ?? <span className="text-slate-300">—</span>}</td>
                {showAffiliation && (
                  <td className="px-4 py-2.5 text-slate-600">{u.affiliation ?? <span className="text-slate-300">—</span>}</td>
                )}
                {showAffiliation && (
                  <td className="px-4 py-2.5 text-slate-600">{u.position ?? <span className="text-slate-300">—</span>}</td>
                )}
                <ChipCell chips={u.chips} emptyLabel={chipsEmptyLabel} />
                {chips2Header && (
                  <ChipCell
                    chips={u.chips2 ?? []}
                    emptyLabel={chips2EmptyLabel}
                    onSet={canAssign ? () => setAssignUser(u) : undefined}
                  />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 표 밖 오른쪽: 선택 후 '정보 변경' 하나로 수정·재발급·삭제 */}
      <div className="flex items-center justify-end gap-2">
        {selected.size > 0 && (
          <span className="mr-auto text-sm text-slate-500">{selected.size}명 선택됨</span>
        )}
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          {roleLabel} 정보 변경
        </button>
      </div>

      {open && (
        <ManageModal
          roleLabel={roleLabel}
          users={selectedUsers}
          showAffiliation={showAffiliation}
          deleteAction={deleteAction}
          updateAction={updateAction}
          resetPasswordAction={resetPasswordAction}
          sessionOptions={canAssign ? sessionOptions : undefined}
          setSessionsAction={canAssign ? setSessionsAction : undefined}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            setSelected(new Set())
            router.refresh()
          }}
        />
      )}

      {assignUser && canAssign && (
        <SessionAssignModal
          user={assignUser}
          roleLabel={roleLabel}
          sessionOptions={sessionOptions!}
          setSessionsAction={setSessionsAction!}
          onClose={() => setAssignUser(null)}
          onDone={() => {
            setAssignUser(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// 개별 분과 배정 모달 — 칩 셀 '설정'으로 연다. 체크된 분과 = 배정.
function SessionAssignModal({
  user,
  roleLabel,
  sessionOptions,
  setSessionsAction,
  onClose,
  onDone,
}: {
  user: ManagedUser
  roleLabel: string
  sessionOptions: { id: string; label: string; group?: string }[]
  setSessionsAction: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
  onDone: () => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(user.assignedSessionIds ?? []))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const toggleSession = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const sessionGroups = new Map<string, { id: string; label: string }[]>()
  for (const s of sessionOptions) {
    const key = s.group ?? '기타'
    if (!sessionGroups.has(key)) sessionGroups.set(key, [])
    sessionGroups.get(key)!.push({ id: s.id, label: s.label })
  }
  const save = () => {
    setError('')
    start(async () => {
      const res = await setSessionsAction(user.id, [...checked])
      if (res.ok) onDone()
      else setError(res.error ?? '배정에 실패했습니다.')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900">분과 배정</h3>
        <p className="mt-1 text-sm text-slate-500">
          <b className="text-slate-700">{user.name}</b> {roleLabel}이 참여할 분과를 체크하세요.
          {roleLabel === '담당자' && ' 분과당 담당자는 1명이라 기존 담당자는 교체됩니다.'}
        </p>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">분과 목록</span>
            <span className="text-xs text-slate-400">{checked.size}개 선택</span>
          </div>
          {sessionOptions.length === 0 ? (
            <p className="text-xs text-slate-400">배정 가능한 분과가 없습니다. 먼저 사업·분과를 등록하세요.</p>
          ) : (
            <div className="thin-scrollbar max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {[...sessionGroups.entries()].map(([group, opts]) => (
                <div key={group}>
                  <div className="px-1 py-0.5 text-xs font-semibold text-slate-400">{group}</div>
                  {opts.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked.has(o.id)}
                        onChange={() => toggleSession(o.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700">{o.label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 정보 변경 모달 — 상단 이름 칩으로 활성 인원을 바꿔 각자 수정, 하단에서 일괄 삭제.
function ManageModal({
  roleLabel,
  users,
  showAffiliation,
  deleteAction,
  updateAction,
  resetPasswordAction,
  sessionOptions,
  setSessionsAction,
  onClose,
  onDone,
}: {
  roleLabel: string
  users: ManagedUser[]
  showAffiliation: boolean
  deleteAction: (ids: string[]) => Promise<void>
  updateAction: (id: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>
  resetPasswordAction: (id: string) => Promise<{ ok: boolean; password?: string }>
  sessionOptions?: { id: string; label: string; group?: string }[]
  setSessionsAction?: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
  onDone: () => void
}) {
  // 여러 명 선택 시에도 각자 수정 가능 — 상단 이름 칩으로 활성 사용자 전환.
  const [activeId, setActiveId] = useState(users[0]?.id ?? '')
  const active = users.find((u) => u.id === activeId) ?? users[0] ?? null
  const multi = users.length > 1
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  // 저장 성공 처리 — 1명이면 닫고 새로고침, 여러 명이면 모달을 유지하고 다음 미저장 인원으로 이동.
  const handleSaved = (id: string) => {
    if (!multi) {
      onDone()
      return
    }
    const next = new Set(savedIds)
    next.add(id)
    setSavedIds(next)
    const nextUser = users.find((u) => !next.has(u.id))
    if (nextUser) setActiveId(nextUser.id)
  }
  // 닫기 — 저장한 게 있으면 목록을 새로고침하며 닫는다.
  const close = () => (savedIds.size > 0 ? onDone() : onClose())

  const removeAll = () => {
    start(async () => {
      await deleteAction(users.map((u) => u.id))
      onDone()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900">{roleLabel} 정보 변경</h3>

        {multi && (
          <div className="mt-3">
            <p className="text-xs text-slate-400">선택한 {roleLabel} {users.length}명 — 이름을 눌러 각각 수정하세요.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setActiveId(u.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    u.id === active?.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {savedIds.has(u.id) && <span className={u.id === active?.id ? 'text-emerald-200' : 'text-emerald-600'}>✓ </span>}
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {active && (
          <EditUserForm
            key={active.id}
            user={active}
            roleLabel={roleLabel}
            showAffiliation={showAffiliation}
            sessionOptions={sessionOptions}
            updateAction={updateAction}
            resetPasswordAction={resetPasswordAction}
            setSessionsAction={setSessionsAction}
            onSaved={() => handleSaved(active.id)}
          />
        )}

        <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {confirmDelete ? (
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <span className="text-sm text-rose-700">{users.length}명을 삭제할까요? 계정·관련 정보가 모두 제거됩니다.</span>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-sm text-slate-500">취소</button>
                <button
                  type="button"
                  onClick={removeAll}
                  disabled={pending}
                  className="rounded-md bg-rose-600 px-3 py-1 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {pending ? '삭제 중…' : '삭제'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                {multi ? `${users.length}명 삭제` : '삭제'}
              </button>
              <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// 개별 사용자 편집 폼 — 활성 사용자 1명의 정보/비밀번호/분과 배정을 수정·저장.
// key={user.id}로 렌더되어 사용자를 전환하면 입력 상태가 새로 초기화된다.
function EditUserForm({
  user,
  roleLabel,
  showAffiliation,
  sessionOptions,
  updateAction,
  resetPasswordAction,
  setSessionsAction,
  onSaved,
}: {
  user: ManagedUser
  roleLabel: string
  showAffiliation: boolean
  sessionOptions?: { id: string; label: string; group?: string }[]
  updateAction: (id: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>
  resetPasswordAction: (id: string) => Promise<{ ok: boolean; password?: string }>
  setSessionsAction?: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
  onSaved: () => void
}) {
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [affiliation, setAffiliation] = useState(user.affiliation ?? '')
  const [position, setPosition] = useState(user.position ?? '')
  const [newPw, setNewPw] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const canAssign = !!(sessionOptions && setSessionsAction)
  const [checked, setChecked] = useState<Set<string>>(new Set(user.assignedSessionIds ?? []))
  const toggleSession = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const sessionGroups = new Map<string, { id: string; label: string }[]>()
  for (const s of sessionOptions ?? []) {
    const key = s.group ?? '기타'
    if (!sessionGroups.has(key)) sessionGroups.set(key, [])
    sessionGroups.get(key)!.push({ id: s.id, label: s.label })
  }

  const save = () => {
    setError('')
    const fd = new FormData()
    fd.set('name', name)
    fd.set('phone', phone)
    fd.set('affiliation', affiliation)
    fd.set('position', position)
    start(async () => {
      const res = await updateAction(user.id, fd)
      if (!res.ok) {
        setError(res.error ?? '저장에 실패했습니다.')
        return
      }
      if (canAssign) {
        const ares = await setSessionsAction!(user.id, [...checked])
        if (!ares.ok) {
          setError(ares.error ?? '분과 배정에 실패했습니다.')
          return
        }
      }
      onSaved()
    })
  }
  const reset = () => {
    setError('')
    start(async () => {
      const res = await resetPasswordAction(user.id)
      if (res.ok && res.password) setNewPw(res.password)
      else setError('재발급에 실패했습니다.')
    })
  }

  return (
    <div className="mt-4 space-y-3">
      <Field label="이름">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="아이디">
        <input value={user.username} disabled className={`${inputCls} bg-slate-50 text-slate-400`} />
      </Field>
      <Field label="연락처">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
      </Field>
      {showAffiliation && (
        <>
          <Field label="소속">
            <input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} className={inputCls} />
          </Field>
          <Field label="직급">
            <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} />
          </Field>
        </>
      )}
      <Field label="비밀번호">
        <div className="flex items-center gap-2">
          <input
            value={newPw ?? user.tempPassword ?? '(변경됨 — 재발급 필요)'}
            disabled
            className={`${inputCls} bg-slate-50 font-mono ${newPw ? 'text-emerald-600' : 'text-slate-500'}`}
          />
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm whitespace-nowrap text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            재발급
          </button>
        </div>
      </Field>
      {newPw && <p className="text-xs text-emerald-600">새 임시 비밀번호가 발급되었습니다: <b>{newPw}</b></p>}

      {canAssign && (
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">분과 배정</span>
            <span className="text-xs text-slate-400">{checked.size}개 선택</span>
          </div>
          {sessionOptions!.length === 0 ? (
            <p className="text-xs text-slate-400">배정 가능한 분과가 없습니다. 먼저 사업·분과를 등록하세요.</p>
          ) : (
            <div className="thin-scrollbar max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {[...sessionGroups.entries()].map(([group, opts]) => (
                <div key={group}>
                  <div className="px-1 py-0.5 text-xs font-semibold text-slate-400">{group}</div>
                  {opts.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked.has(o.id)}
                        onChange={() => toggleSession(o.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700">{o.label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-400">
            체크한 분과에 배정됩니다. ‘저장’ 시 정보와 함께 한 번에 반영됩니다.
            {roleLabel === '담당자' && ' 분과당 담당자는 1명이라 기존 담당자는 교체됩니다.'}
          </p>
        </div>
      )}

      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending || !name.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

// 칩 목록 셀 — 참여 사업/참여 분과 등. 빈 경우 안내 라벨.
// 칩 목록 셀. onSet이 있으면 '설정' 버튼으로 배정 모달을 연다.
// (버튼은 stopPropagation으로 행 체크박스 토글을 막는다.)
function ChipCell({
  chips,
  emptyLabel,
  onSet,
}: {
  chips: { label: string; href?: string }[]
  emptyLabel: string
  onSet?: () => void
}) {
  // 행 선택 토글을 막고 배정 모달 열기
  const setBtn = onSet ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSet()
      }}
      className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
    >
      설정
    </button>
  ) : null

  return (
    <td className="px-4 py-2.5">
      {chips.length === 0 ? (
        <span className="flex justify-center">{setBtn ?? <span className="text-xs text-slate-400">{emptyLabel}</span>}</span>
      ) : (
        <span className="flex flex-wrap items-center justify-center gap-1">
          {chips.map((c, i) =>
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
          {setBtn}
        </span>
      )}
    </td>
  )
}

// 예쁜 체크박스 — 선택 상태에 따라 남색 배경 + 흰 체크.
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
