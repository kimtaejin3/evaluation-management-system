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
  assignAction,
  assignSingle = false,
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
  // 분과 배정(관리자 전용) — 둘 다 있으면 '분과 배정' 버튼·모달 노출
  sessionOptions?: { id: string; label: string; group?: string }[]
  assignAction?: (userIds: string[], sessionId: string) => Promise<{ ok: boolean; error?: string }>
  // 1분과=1인 배정(담당자) — 정확히 1명 선택했을 때만 배정 가능
  assignSingle?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const canAssign = !!(sessionOptions && assignAction)

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
                {chips2Header && <ChipCell chips={u.chips2 ?? []} emptyLabel={chips2EmptyLabel} />}
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
        {canAssign && (
          <button
            type="button"
            disabled={assignSingle ? selected.size !== 1 : selected.size === 0}
            onClick={() => setAssignOpen(true)}
            title={assignSingle ? '담당자는 분과당 1명 — 1명만 선택하세요' : undefined}
            className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            분과 배정
          </button>
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
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            setSelected(new Set())
            router.refresh()
          }}
        />
      )}

      {assignOpen && canAssign && (
        <AssignModal
          roleLabel={roleLabel}
          single={assignSingle}
          users={selectedUsers}
          sessionOptions={sessionOptions!}
          assignAction={assignAction!}
          onClose={() => setAssignOpen(false)}
          onDone={() => {
            setAssignOpen(false)
            setSelected(new Set())
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// 분과 배정 모달(관리자) — 선택 인원을 한 분과에 배정.
function AssignModal({
  roleLabel,
  single,
  users,
  sessionOptions,
  assignAction,
  onClose,
  onDone,
}: {
  roleLabel: string
  single: boolean
  users: ManagedUser[]
  sessionOptions: { id: string; label: string; group?: string }[]
  assignAction: (userIds: string[], sessionId: string) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
  onDone: () => void
}) {
  const [sessionId, setSessionId] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  // 사업(group)별로 optgroup 구성
  const groups = new Map<string, { id: string; label: string }[]>()
  for (const s of sessionOptions) {
    const key = s.group ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ id: s.id, label: s.label })
  }

  const submit = () => {
    if (!sessionId) {
      setError('배정할 분과를 선택하세요.')
      return
    }
    setError('')
    start(async () => {
      const res = await assignAction(users.map((u) => u.id), sessionId)
      if (res.ok) onDone()
      else setError(res.error ?? '배정에 실패했습니다.')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900">분과 배정</h3>
        <p className="mt-1 text-sm text-slate-500">
          {single
            ? `선택한 ${roleLabel}를 지정한 분과의 담당자로 배정합니다. 분과당 담당자는 1명이며 기존 담당자가 있으면 교체됩니다.`
            : `선택한 ${roleLabel}을 지정한 분과에 배정합니다. 배정된 ${roleLabel}은 즉시 평가에 참여할 수 있습니다.`}
        </p>

        <div className="mt-4">
          <p className="text-sm text-slate-600">선택한 {roleLabel} {users.length}명:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {users.map((u) => (
              <span key={u.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{u.name}</span>
            ))}
          </div>
        </div>

        <Field label="배정할 분과">
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={inputCls}>
            <option value="" disabled>분과 선택</option>
            {[...groups.entries()].map(([group, opts]) =>
              group ? (
                <optgroup key={group} label={group}>
                  {opts.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </optgroup>
              ) : (
                opts.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))
              ),
            )}
          </select>
        </Field>

        {sessionOptions.length === 0 && (
          <p className="mt-3 text-sm text-amber-600">배정 가능한 분과가 없습니다. 먼저 사업·분과를 등록하세요.</p>
        )}
        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !sessionId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? '배정 중…' : '배정'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 정보 변경 모달 — 1명이면 수정/재발급/삭제, 여러 명이면 삭제만.
function ManageModal({
  roleLabel,
  users,
  showAffiliation,
  deleteAction,
  updateAction,
  resetPasswordAction,
  onClose,
  onDone,
}: {
  roleLabel: string
  users: ManagedUser[]
  showAffiliation: boolean
  deleteAction: (ids: string[]) => Promise<void>
  updateAction: (id: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>
  resetPasswordAction: (id: string) => Promise<{ ok: boolean; password?: string }>
  onClose: () => void
  onDone: () => void
}) {
  const single = users.length === 1 ? users[0] : null
  const [name, setName] = useState(single?.name ?? '')
  const [phone, setPhone] = useState(single?.phone ?? '')
  const [affiliation, setAffiliation] = useState(single?.affiliation ?? '')
  const [position, setPosition] = useState(single?.position ?? '')
  const [newPw, setNewPw] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, start] = useTransition()

  const save = () => {
    if (!single) return
    setError('')
    const fd = new FormData()
    fd.set('name', name)
    fd.set('phone', phone)
    fd.set('affiliation', affiliation)
    fd.set('position', position)
    start(async () => {
      const res = await updateAction(single.id, fd)
      if (res.ok) onDone()
      else setError(res.error ?? '저장에 실패했습니다.')
    })
  }
  const reset = () => {
    if (!single) return
    setError('')
    start(async () => {
      const res = await resetPasswordAction(single.id)
      if (res.ok && res.password) setNewPw(res.password)
      else setError('재발급에 실패했습니다.')
    })
  }
  const remove = () => {
    start(async () => {
      await deleteAction(users.map((u) => u.id))
      onDone()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900">{roleLabel} 정보 변경</h3>

        {single ? (
          <div className="mt-4 space-y-3">
            <Field label="이름">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="아이디">
              <input value={single.username} disabled className={`${inputCls} bg-slate-50 text-slate-400`} />
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
                  value={newPw ?? single.tempPassword ?? '(변경됨 — 재발급 필요)'}
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
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-slate-600">선택한 {roleLabel} {users.length}명:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {users.map((u) => (
                <span key={u.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{u.name}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">여러 명은 삭제만 가능합니다. 수정·재발급은 한 명씩 선택하세요.</p>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-2">
          {confirmDelete ? (
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <span className="text-sm text-rose-700">{users.length}명을 삭제할까요? 계정·관련 정보가 모두 제거됩니다.</span>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-sm text-slate-500">취소</button>
                <button
                  type="button"
                  onClick={remove}
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
                삭제
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                  닫기
                </button>
                {single && (
                  <button
                    type="button"
                    onClick={save}
                    disabled={pending || !name.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {pending ? '저장 중…' : '저장'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
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
function ChipCell({ chips, emptyLabel }: { chips: { label: string; href?: string }[]; emptyLabel: string }) {
  return (
    <td className="px-4 py-2.5">
      {chips.length === 0 ? (
        <span className="text-xs text-slate-400">{emptyLabel}</span>
      ) : (
        <span className="flex flex-wrap justify-center gap-1">
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
