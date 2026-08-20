'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useClientSort, SortTh } from '@/components/client-sort'
import ConfirmModalButton from '@/components/ConfirmModalButton'

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
  // 현재 배정된 분과 id 목록 — 분과 배정 체크박스 초기값
  assignedSessionIds?: string[]
  // 현재 참여 사업 id 목록 — 사업 설정 체크박스 초기값 + 분과 설정 범위 제한
  assignedProjectIds?: string[]
  // 사업×분과 짝 행(pairMode) — 한 짝이 한 줄, 사람 정보는 rowSpan 으로 병합.
  // progress: 시작 전(BEFORE)/진행중(ONGOING)/완료(DONE)
  pairs?: { project: string | null; session: string | null; progress?: PairProgress }[]
}

// 정렬 가능한 텍스트 컬럼
type SortKey = 'name' | 'username' | 'phone' | 'affiliation' | 'position'

// 짝 행의 평가 진행 상황 — 배경·테두리 없이 색 글씨로만 구분
export type PairProgress = 'BEFORE' | 'ONGOING' | 'DONE'
const PROGRESS_LABEL: Record<PairProgress, { label: string; cls: string }> = {
  BEFORE: { label: '시작 전', cls: 'text-slate-400' },
  ONGOING: { label: '진행중', cls: 'text-blue-600' },
  DONE: { label: '완료', cls: 'text-emerald-600' },
}

// 필터 셀렉트에서 '미참여/미배정'을 뜻하는 특수 값 — id 와 충돌하지 않는 문자열
const NONE_FILTER = '__none__'

// 필터 드롭다운 — 검색 입력과 높이·테두리를 맞춘 커스텀 화살표 셀렉트.
// '전체' / '없음(미참여·미배정)' 고정 옵션 뒤에 children 옵션을 렌더한다.
function FilterSelect({
  value,
  onChange,
  ariaLabel,
  allLabel,
  noneLabel,
  children,
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  allLabel: string
  noneLabel: string
  children: ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="h-9 appearance-none rounded-lg border border-slate-300 bg-white pr-8 pl-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
      >
        <option value="">{allLabel}</option>
        <option value={NONE_FILTER}>{noneLabel}</option>
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400"
      >
        ▾
      </span>
    </div>
  )
}

// 담당자·평가위원 관리 공통 표.
// - 체크박스를 항상 노출(상시 선택 가능). 머리글 체크박스로 전체 선택.
// - 표 아래 오른쪽: '삭제'(선택 일괄) + '{roleLabel} 정보 변경'(수정·재발급) / 여러 명은 '일괄 설정'.
//   행 끝 아이콘으로 1명 수정·삭제도 가능. 정보 변경 모달 안에는 삭제가 없다.
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
  projectOptions,
  setProjectsAction,
  pairMode = false,
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
  // 분과 배정 — '정보 변경' 모달과 분과 칸 '설정'에서 사용. projectId로 사업별 범위 제한.
  sessionOptions?: { id: string; label: string; group?: string; projectId?: string }[]
  // 한 사용자의 분과 배정을 한 번에 설정(체크된 분과 = 배정)
  setSessionsAction?: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
  // 사업 참여 설정(담당자) — 참여 사업 칸 '사업 설정'에서 사용
  projectOptions?: { id: string; label: string }[]
  setProjectsAction?: (userId: string, projectIds: string[]) => Promise<{ ok: boolean; error?: string }>
  // 사업·분과를 칩 나열 대신 짝 행(엑셀 병합 스타일)으로 — 평가위원 관리에서 사용
  pairMode?: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  // 여러 명 선택 시 '정보 변경' 대신 뜨는 '사업 및 분과 일괄 설정' 모달
  const [bulkOpen, setBulkOpen] = useState(false)
  // 하단 '삭제' 버튼 — 선택된 사람 일괄 삭제(확인은 모달)
  const [deleting, startDelete] = useTransition()
  // 행 아이콘 버튼 — 해당 1명 수정 모달 / 삭제 확인
  const [editUser, setEditUser] = useState<ManagedUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null)
  // 필터·정렬 — 클라이언트에서만 처리(원본 순서는 서버의 등록순 유지)
  const [query, setQuery] = useState('')
  // '' = 전체, NONE_FILTER = 미참여/미배정, 그 외 = 해당 id
  const [projectFilter, setProjectFilter] = useState('')
  const [sessionFilter, setSessionFilter] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } = useClientSort<SortKey>()
  // 칩 셀의 '설정'으로 여는 개별 배정 모달 대상 사용자
  const [sessionUser, setSessionUser] = useState<ManagedUser | null>(null)
  const [projectUser, setProjectUser] = useState<ManagedUser | null>(null)
  // 사업 설정 저장 직후 리로드 전에도 '분과 설정'이 최신 참여 사업을 보도록 로컬 오버라이드
  const [projectOverrides, setProjectOverrides] = useState<Record<string, string[]>>({})
  const canAssign = !!(sessionOptions && setSessionsAction)
  const canSetProjects = !!(projectOptions && setProjectsAction)

  // 검색어(이름·아이디·연락처·소속·직급·칩 라벨) + 사업 필터 적용 후 정렬
  const q = query.trim().toLowerCase()
  const filteredUsers = users.filter((u) => {
    const projectIds = u.assignedProjectIds ?? []
    if (projectFilter === NONE_FILTER) {
      if (projectIds.length > 0) return false
    } else if (projectFilter && !projectIds.includes(projectFilter)) return false
    const sessionIds = u.assignedSessionIds ?? []
    if (sessionFilter === NONE_FILTER) {
      if (sessionIds.length > 0) return false
    } else if (sessionFilter && !sessionIds.includes(sessionFilter)) return false
    if (!q) return true
    const haystack = [
      u.name,
      u.username,
      u.phone ?? '',
      u.affiliation ?? '',
      u.position ?? '',
      ...u.chips.map((c) => c.label),
      ...(u.chips2 ?? []).map((c) => c.label),
    ]
    return haystack.some((v) => v.toLowerCase().includes(q))
  })
  const visibleUsers = sortRows(filteredUsers, (u, k) => u[k] ?? '')

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  // 전체 선택은 현재 보이는(필터된) 행 기준
  const allChecked = visibleUsers.length > 0 && visibleUsers.every((u) => selected.has(u.id))
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) visibleUsers.forEach((u) => next.delete(u.id))
      else visibleUsers.forEach((u) => next.add(u.id))
      return next
    })

  const selectedUsers = users.filter((u) => selected.has(u.id))
  // 이름/아이디/연락처 + (비밀번호) + (소속/직급) + chips + (chips2) + (진행 상황) + 관리 + 체크박스
  const cols = 4 + (showPassword ? 1 : 0) + (showAffiliation ? 2 : 0) + (chips2Header ? 1 : 0) + (pairMode ? 1 : 0) + 2

  return (
    <div className="space-y-3">
      {/* 필터 도구줄 — 검색 + (사업 필터) */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·아이디·연락처 검색"
          className="h-9 w-64 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        {projectOptions && projectOptions.length > 0 && (
          <FilterSelect
            value={projectFilter}
            onChange={setProjectFilter}
            ariaLabel="사업 필터"
            allLabel="전체 사업"
            noneLabel={`사업 ${chipsEmptyLabel}`}
          >
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </FilterSelect>
        )}
        {sessionOptions && sessionOptions.length > 0 && chips2Header && (
          <FilterSelect
            value={sessionFilter}
            onChange={setSessionFilter}
            ariaLabel="분과 필터"
            allLabel="전체 분과"
            noneLabel={`분과 ${chips2EmptyLabel}`}
          >
            {[...new Set(sessionOptions.map((s) => s.group ?? '기타'))].map((group) => (
              <optgroup key={group} label={group}>
                {sessionOptions
                  .filter((s) => (s.group ?? '기타') === group)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </FilterSelect>
        )}
        {(query || projectFilter || sessionFilter) && (
          <span className="text-sm text-slate-500">
            {visibleUsers.length}명 표시
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setProjectFilter('')
                setSessionFilter('')
              }}
              className="ml-2 text-indigo-500 hover:underline"
            >
              초기화
            </button>
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="w-12 px-4 py-2.5">
                <button type="button" onClick={toggleAll} aria-label="전체 선택">
                  <PrettyCheck checked={allChecked} />
                </button>
              </th>
              <SortTh label="이름" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-2.5 font-medium" />
              <SortTh label="아이디" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-2.5 font-medium" />
              {showPassword && <th className="px-4 py-2.5 font-medium">비밀번호</th>}
              <SortTh label="연락처" field="phone" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-2.5 font-medium" />
              {showAffiliation && (
                <SortTh label="소속" field="affiliation" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-2.5 font-medium" />
              )}
              {showAffiliation && (
                <SortTh label="직급" field="position" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-2.5 font-medium" />
              )}
              <th className="px-4 py-2.5 font-medium">{chipsHeader}</th>
              {chips2Header && <th className="px-4 py-2.5 font-medium">{chips2Header}</th>}
              {pairMode && <th className="px-4 py-2.5 font-medium">평가 진행 상황</th>}
              <th className="w-20 px-4 py-2.5 font-medium text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-10 text-center text-slate-400">
                  {users.length === 0 ? emptyLabel : '검색 결과가 없습니다.'}
                </td>
              </tr>
            )}
            {visibleUsers.map((u) => {
              const isSel = selected.has(u.id)
              const rowCls = `cursor-pointer transition ${isSel ? 'bg-indigo-50' : 'hover:bg-slate-50/60'}`
              const infoCells = (rowSpan: number) => (
                <>
                  <td rowSpan={rowSpan} className="border-b border-slate-100 px-4 py-2.5">
                    <PrettyCheck checked={isSel} />
                  </td>
                  <td rowSpan={rowSpan} className="border-b border-slate-100 px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
                  <td rowSpan={rowSpan} className="border-b border-slate-100 px-4 py-2.5 text-slate-600">{u.username}</td>
                  {showPassword && (
                    <td rowSpan={rowSpan} className="border-b border-slate-100 px-4 py-2.5">
                      {u.tempPassword ? (
                        <span className="font-mono text-sm tabular-nums text-slate-700">{u.tempPassword}</span>
                      ) : (
                        <span className="text-xs text-slate-400">재발급 필요</span>
                      )}
                    </td>
                  )}
                  <td rowSpan={rowSpan} className="border-b border-slate-100 px-4 py-2.5 text-slate-600">{u.phone ?? <span className="text-slate-300">—</span>}</td>
                  {showAffiliation && (
                    <td rowSpan={rowSpan} className="border-b border-slate-100 px-4 py-2.5 text-slate-600">{u.affiliation ?? <span className="text-slate-300">—</span>}</td>
                  )}
                  {showAffiliation && (
                    <td rowSpan={rowSpan} className="border-b border-slate-100 px-4 py-2.5 text-slate-600">{u.position ?? <span className="text-slate-300">—</span>}</td>
                  )}
                </>
              )

              if (!pairMode) {
                return (
                  <tr key={u.id} onClick={() => toggle(u.id)} className={rowCls}>
                    {infoCells(1)}
                    <ChipCell
                      chips={u.chips}
                      emptyLabel={chipsEmptyLabel}
                      setLabel="사업 설정"
                      onSet={canSetProjects ? () => setProjectUser(u) : undefined}
                    />
                    {chips2Header && (
                      <ChipCell
                        chips={u.chips2 ?? []}
                        emptyLabel={chips2EmptyLabel}
                        setLabel="분과 설정"
                        onSet={canAssign ? () => setSessionUser(u) : undefined}
                      />
                    )}
                    <RowActionsCell rowSpan={1} onEdit={() => setEditUser(u)} onDelete={() => setDeleteUser(u)} />
                  </tr>
                )
              }

              // 짝 행 모드 — (사업, 분과) 한 짝이 한 줄. 사람 정보는 첫 줄에서 rowSpan 병합.
              const pairs =
                u.pairs && u.pairs.length > 0
                  ? u.pairs
                  : [{ project: null, session: null, progress: undefined as PairProgress | undefined }]
              return pairs.map((pair, pi) => (
                <tr key={`${u.id}-${pi}`} onClick={() => toggle(u.id)} className={rowCls}>
                  {pi === 0 && infoCells(pairs.length)}
                  <td
                    className={`px-4 py-1.5 text-center ${pi === pairs.length - 1 ? 'border-b border-slate-100' : 'border-b border-slate-50'}`}
                  >
                    {pair.project ? (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{pair.project}</span>
                    ) : canSetProjects && pi === 0 ? (
                      <SetLink label="사업 설정" onClick={() => setProjectUser(u)} />
                    ) : (
                      <span className="text-xs text-slate-400">{chipsEmptyLabel}</span>
                    )}
                  </td>
                  {chips2Header && (
                    <td
                      className={`px-4 py-1.5 text-center ${pi === pairs.length - 1 ? 'border-b border-slate-100' : 'border-b border-slate-50'}`}
                    >
                      {pair.session ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{pair.session}</span>
                      ) : canAssign && pi === 0 ? (
                        <SetLink label="분과 설정" onClick={() => setSessionUser(u)} />
                      ) : (
                        <span className="text-xs text-slate-400">{chips2EmptyLabel}</span>
                      )}
                    </td>
                  )}
                  {/* 평가 진행 상황 — 시작 전(회색)/진행중(파랑)/완료(초록), 글씨 색으로만 구분 */}
                  <td
                    className={`px-4 py-1.5 text-center ${pi === pairs.length - 1 ? 'border-b border-slate-100' : 'border-b border-slate-50'}`}
                  >
                    {(pair.project || pair.session) && pair.progress ? (
                      <span className={`text-xs font-medium whitespace-nowrap ${PROGRESS_LABEL[pair.progress].cls}`}>
                        {PROGRESS_LABEL[pair.progress].label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  {pi === 0 && (
                    <RowActionsCell
                      rowSpan={pairs.length}
                      onEdit={() => setEditUser(u)}
                      onDelete={() => setDeleteUser(u)}
                    />
                  )}
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>

      {/* 표 밖 오른쪽: 삭제 + '정보 변경'(1명) / '일괄 설정'(여러 명) */}
      <div className="flex items-center justify-end gap-2">
        {selected.size > 0 && (
          <span className="mr-auto text-sm text-slate-500">{selected.size}명 선택됨</span>
        )}
        <ConfirmModalButton
          label="삭제"
          pendingLabel="삭제 중…"
          pending={deleting}
          disabled={selected.size === 0}
          title={`${roleLabel} 삭제`}
          body={`${roleLabel} ${selected.size}명(${selectedUsers.map((u) => u.name).join(', ')})을 삭제합니다. 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          onConfirm={() =>
            startDelete(async () => {
              await deleteAction([...selected])
              window.location.reload()
            })
          }
          className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        />
        {selected.size >= 2 && canAssign && canSetProjects ? (
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50"
          >
            사업 및 분과 일괄 설정
          </button>
        ) : (
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {roleLabel} 정보 변경
          </button>
        )}
      </div>

      {bulkOpen && canAssign && canSetProjects && (
        <BulkAssignModal
          users={selectedUsers}
          projectOptions={projectOptions!}
          setProjectsAction={setProjectsAction!}
          sessionOptions={sessionOptions!}
          setSessionsAction={setSessionsAction!}
          chips2EmptyLabel={chips2EmptyLabel}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setBulkOpen(false)
            setSelected(new Set())
            window.location.reload()
          }}
        />
      )}

      {open && (
        <ManageModal
          roleLabel={roleLabel}
          users={selectedUsers}
          showAffiliation={showAffiliation}
          updateAction={updateAction}
          resetPasswordAction={resetPasswordAction}
          sessionOptions={canAssign ? sessionOptions : undefined}
          setSessionsAction={canAssign ? setSessionsAction : undefined}
          projectOptions={canSetProjects ? projectOptions : undefined}
          setProjectsAction={canSetProjects ? setProjectsAction : undefined}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            setSelected(new Set())
            window.location.reload()
          }}
        />
      )}

      {/* 행 아이콘: 수정 — 해당 1명만 담은 정보 변경 모달 */}
      {editUser && (
        <ManageModal
          roleLabel={roleLabel}
          users={[editUser]}
          showAffiliation={showAffiliation}
          updateAction={updateAction}
          resetPasswordAction={resetPasswordAction}
          sessionOptions={canAssign ? sessionOptions : undefined}
          setSessionsAction={canAssign ? setSessionsAction : undefined}
          projectOptions={canSetProjects ? projectOptions : undefined}
          setProjectsAction={canSetProjects ? setProjectsAction : undefined}
          onClose={() => setEditUser(null)}
          onDone={() => {
            setEditUser(null)
            window.location.reload()
          }}
        />
      )}

      {/* 행 아이콘: 삭제 — 해당 1명 확인 모달 */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteUser(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{roleLabel} 삭제</h3>
            <p className="text-sm text-slate-600">
              <b className="text-slate-800">{deleteUser.name}</b>({deleteUser.username}) {roleLabel}을 삭제합니다. 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteUser(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    await deleteAction([deleteUser.id])
                    window.location.reload()
                  })
                }
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {projectUser && canSetProjects && (
        <ProjectAssignModal
          user={projectUser}
          roleLabel={roleLabel}
          projectOptions={projectOptions!}
          setProjectsAction={setProjectsAction!}
          onClose={() => setProjectUser(null)}
          onDone={(savedIds) => {
            // refresh가 끝나기 전에 '분과 설정'을 열어도 최신 참여 사업이 보이도록 오버라이드
            setProjectOverrides((prev) => ({ ...prev, [projectUser.id]: savedIds }))
            setProjectUser(null)
            window.location.reload()
          }}
        />
      )}

      {sessionUser && canAssign && (
        <SessionAssignModal
          user={sessionUser}
          roleLabel={roleLabel}
          sessionOptions={sessionOptions!}
          // 담당자(사업 참여 개념 있음)는 참여 사업의 분과만 고르게 제한. 평가위원은 전체.
          // 방금 저장한 사업 설정(오버라이드)이 있으면 그것을 우선 사용.
          restrictProjectIds={
            canSetProjects ? (projectOverrides[sessionUser.id] ?? sessionUser.assignedProjectIds ?? []) : null
          }
          setSessionsAction={setSessionsAction!}
          onClose={() => setSessionUser(null)}
          onDone={() => {
            setSessionUser(null)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

// 사업 및 분과 일괄 설정 모달 — 여러 명 선택 시 '정보 변경' 대신 사용.
// 위: 사업 참여를 전원에게 일괄 적용(체크된 사업 = 참여, 초기값은 선택자들의 합집합).
// 아래: 사람마다 분과 드롭다운 — 체크된 사업의 분과만 고를 수 있고, 바꾼 사람만 저장된다.
function BulkAssignModal({
  users,
  projectOptions,
  setProjectsAction,
  sessionOptions,
  setSessionsAction,
  chips2EmptyLabel,
  onClose,
  onDone,
}: {
  users: ManagedUser[]
  projectOptions: { id: string; label: string }[]
  setProjectsAction: (userId: string, projectIds: string[]) => Promise<{ ok: boolean; error?: string }>
  sessionOptions: { id: string; label: string; group?: string; projectId?: string }[]
  setSessionsAction: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
  chips2EmptyLabel: string
  onClose: () => void
  onDone: () => void
}) {
  // 사업 초기값: 선택된 사람들의 참여 사업 합집합 — 체크 해제 전까지는 누구의 참여도 사라지지 않는다
  const [checkedProjects, setCheckedProjects] = useState<Set<string>>(
    () => new Set(users.flatMap((u) => u.assignedProjectIds ?? []).filter((id) => projectOptions.some((p) => p.id === id))),
  )
  // 사람별 분과 초기값: 현재 배정 중 옵션에 있는 첫 분과
  const initialSession = (u: ManagedUser) =>
    (u.assignedSessionIds ?? []).find((id) => sessionOptions.some((s) => s.id === id)) ?? ''
  const [sessionByUser, setSessionByUser] = useState<Record<string, string>>(() =>
    Object.fromEntries(users.map((u) => [u.id, initialSession(u)])),
  )
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const toggleProject = (id: string) =>
    setCheckedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // 드롭다운에는 체크된 사업의 분과만 — 사업 체크를 풀면 그 분과 선택도 무효화
  const scopedSessions = sessionOptions.filter((s) => !s.projectId || checkedProjects.has(s.projectId))
  const groups = [...new Set(scopedSessions.map((s) => s.group ?? '기타'))]

  const save = () => {
    setError('')
    start(async () => {
      const projectIds = [...checkedProjects]
      for (const u of users) {
        const res = await setProjectsAction(u.id, projectIds)
        if (!res.ok) {
          setError(`${u.name}: ${res.error ?? '사업 설정에 실패했습니다.'}`)
          return
        }
        // 분과는 바꾼 사람만 저장 — 여러 분과에 배정된 사람의 기존 배정을 실수로 지우지 않게
        const chosen = scopedSessions.some((s) => s.id === sessionByUser[u.id]) ? sessionByUser[u.id] : ''
        if (chosen !== initialSession(u)) {
          const res2 = await setSessionsAction(u.id, chosen ? [chosen] : [])
          if (!res2.ok) {
            setError(`${u.name}: ${res2.error ?? '분과 설정에 실패했습니다.'}`)
            return
          }
        }
      }
      onDone()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">사업 및 분과 일괄 설정</h3>
        <p className="text-sm text-slate-500">{users.length}명 선택됨 — 사업은 전원에게 일괄 적용되고, 분과는 사람마다 지정합니다.</p>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">참여 사업 (일괄)</h4>
          <div className="thin-scrollbar max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {projectOptions.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={checkedProjects.has(p.id)}
                  onChange={() => toggleProject(p.id)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">배정 분과 (사람별)</h4>
          <div className="thin-scrollbar max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {users.map((u) => {
              const value = scopedSessions.some((s) => s.id === sessionByUser[u.id]) ? sessionByUser[u.id] : ''
              return (
                <div key={u.id} className="flex items-center justify-between gap-3 px-2 py-1">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                    {u.name}
                    <span className="ml-1.5 text-xs font-normal text-slate-400">{u.username}</span>
                  </span>
                  <select
                    value={value}
                    onChange={(e) => setSessionByUser((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    disabled={scopedSessions.length === 0}
                    className="h-9 w-52 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    aria-label={`${u.name} 분과 선택`}
                  >
                    <option value="">{chips2EmptyLabel}</option>
                    {groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {scopedSessions
                          .filter((s) => (s.group ?? '기타') === g)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
          {scopedSessions.length === 0 && (
            <p className="mt-1.5 text-xs text-slate-400">위에서 사업을 먼저 체크하면 그 사업의 분과를 고를 수 있습니다.</p>
          )}
        </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
            닫기
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

// 개별 사업 참여 설정 모달 — 참여 사업 칸 '사업 설정'으로 연다. 체크된 사업 = 참여.
function ProjectAssignModal({
  user,
  roleLabel,
  projectOptions,
  setProjectsAction,
  onClose,
  onDone,
}: {
  user: ManagedUser
  roleLabel: string
  projectOptions: { id: string; label: string }[]
  setProjectsAction: (userId: string, projectIds: string[]) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
  // 저장 성공 시 체크된 사업 id를 부모에 전달(분과 설정 즉시 반영용)
  onDone: (savedIds: string[]) => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(user.assignedProjectIds ?? []))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const save = () => {
    setError('')
    start(async () => {
      const ids = [...checked]
      const res = await setProjectsAction(user.id, ids)
      if (res.ok) onDone(ids)
      else setError(res.error ?? '저장에 실패했습니다.')
    })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900">사업 설정</h3>
        <p className="mt-1 text-sm text-slate-500">
          <b className="text-slate-700">{user.name}</b> {roleLabel}이 참여할 사업을 체크하세요. 분과는 ‘분과 설정’에서 이 사업 안에서 고릅니다.
        </p>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">사업 목록</span>
            <span className="text-xs text-slate-400">{checked.size}개 선택</span>
          </div>
          {projectOptions.length === 0 ? (
            <p className="text-xs text-slate-400">등록된 사업이 없습니다.</p>
          ) : (
            <div className="thin-scrollbar max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {projectOptions.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700">{p.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">취소</button>
          <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 개별 분과 배정 모달 — 칩 셀 '설정'으로 연다. 체크된 분과 = 배정.
function SessionAssignModal({
  user,
  roleLabel,
  sessionOptions,
  restrictProjectIds,
  setSessionsAction,
  onClose,
  onDone,
}: {
  user: ManagedUser
  roleLabel: string
  sessionOptions: { id: string; label: string; group?: string; projectId?: string }[]
  // 값이 있으면 이 사업(id)들의 분과만 노출(담당자: 참여 사업 안에서만). null이면 전체.
  restrictProjectIds: string[] | null
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
  // 담당자는 참여 사업 안의 분과만. 평가위원은 전체.
  const visibleOptions = restrictProjectIds
    ? sessionOptions.filter((s) => s.projectId && restrictProjectIds.includes(s.projectId))
    : sessionOptions
  const sessionGroups = new Map<string, { id: string; label: string }[]>()
  for (const s of visibleOptions) {
    const key = s.group ?? '기타'
    if (!sessionGroups.has(key)) sessionGroups.set(key, [])
    sessionGroups.get(key)!.push({ id: s.id, label: s.label })
  }
  const needsProjectFirst = restrictProjectIds != null && restrictProjectIds.length === 0
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
        <h3 className="text-lg font-bold text-slate-900">분과 설정</h3>
        <p className="mt-1 text-sm text-slate-500">
          <b className="text-slate-700">{user.name}</b> {roleLabel}이 참여할 분과를 체크하세요.
          {roleLabel === '담당자' && ' 분과당 담당자는 1명이라 기존 담당자는 교체됩니다.'}
        </p>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">분과 목록</span>
            <span className="text-xs text-slate-400">{checked.size}개 선택</span>
          </div>
          {needsProjectFirst ? (
            <p className="text-xs text-amber-600">먼저 ‘사업 설정’에서 참여 사업을 선택하세요.</p>
          ) : visibleOptions.length === 0 ? (
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

// 정보 변경 모달 — 상단 이름 칩으로 활성 인원을 바꿔 각자 수정. 삭제는 표 하단 버튼·행 아이콘에서.
function ManageModal({
  roleLabel,
  users,
  showAffiliation,
  updateAction,
  resetPasswordAction,
  sessionOptions,
  setSessionsAction,
  projectOptions,
  setProjectsAction,
  onClose,
  onDone,
}: {
  roleLabel: string
  users: ManagedUser[]
  showAffiliation: boolean
  updateAction: (id: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>
  resetPasswordAction: (id: string) => Promise<{ ok: boolean; password?: string }>
  sessionOptions?: { id: string; label: string; group?: string; projectId?: string }[]
  setSessionsAction?: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
  projectOptions?: { id: string; label: string }[]
  setProjectsAction?: (userId: string, projectIds: string[]) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
  onDone: () => void
}) {
  // 여러 명 선택 시에도 각자 수정 가능 — 상단 이름 칩으로 활성 사용자 전환.
  const [activeId, setActiveId] = useState(users[0]?.id ?? '')
  const active = users.find((u) => u.id === activeId) ?? users[0] ?? null
  const multi = users.length > 1
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  // 편집 폼의 저장을 하단 버튼 행에서 트리거 + 유효/진행 상태 반영
  const editRef = useRef<{ submit: () => void }>(null)
  const [editStatus, setEditStatus] = useState({ valid: true, busy: false })

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
            ref={editRef}
            user={active}
            roleLabel={roleLabel}
            showAffiliation={showAffiliation}
            sessionOptions={sessionOptions}
            setSessionsAction={setSessionsAction}
            projectOptions={projectOptions}
            setProjectsAction={setProjectsAction}
            updateAction={updateAction}
            resetPasswordAction={resetPasswordAction}
            onStatus={setEditStatus}
            onSaved={() => handleSaved(active.id)}
          />
        )}

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
            닫기
          </button>
          <button
            type="button"
            onClick={() => editRef.current?.submit()}
            disabled={editStatus.busy || !editStatus.valid}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {editStatus.busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 개별 사용자 편집 폼 — 활성 사용자 1명의 정보/비밀번호/분과 배정을 수정·저장.
// key={user.id}로 렌더되어 사용자를 전환하면 입력 상태가 새로 초기화된다.
type EditHandle = { submit: () => void }
const EditUserForm = forwardRef<
  EditHandle,
  {
    user: ManagedUser
    roleLabel: string
    showAffiliation: boolean
    sessionOptions?: { id: string; label: string; group?: string; projectId?: string }[]
    setSessionsAction?: (userId: string, sessionIds: string[]) => Promise<{ ok: boolean; error?: string }>
    projectOptions?: { id: string; label: string }[]
    setProjectsAction?: (userId: string, projectIds: string[]) => Promise<{ ok: boolean; error?: string }>
    updateAction: (id: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>
    resetPasswordAction: (id: string) => Promise<{ ok: boolean; password?: string }>
    onStatus: (s: { valid: boolean; busy: boolean }) => void
    onSaved: () => void
  }
>(function EditUserForm(
  {
    user,
    roleLabel,
    showAffiliation,
    sessionOptions,
    setSessionsAction,
    projectOptions,
    setProjectsAction,
    updateAction,
    resetPasswordAction,
    onStatus,
    onSaved,
  },
  ref,
) {
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [affiliation, setAffiliation] = useState(user.affiliation ?? '')
  const [position, setPosition] = useState(user.position ?? '')
  const [newPw, setNewPw] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const canAssign = !!(sessionOptions && setSessionsAction)
  const canSetProjects = !!(projectOptions && setProjectsAction)
  const [checkedSessions, setCheckedSessions] = useState<Set<string>>(new Set(user.assignedSessionIds ?? []))
  const [checkedProjects, setCheckedProjects] = useState<Set<string>>(new Set(user.assignedProjectIds ?? []))

  const toggleSession = (id: string) =>
    setCheckedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleProject = (id: string) => {
    setCheckedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // 사업 체크 해제 시 그 사업의 분과 선택도 함께 해제
    if (checkedProjects.has(id)) {
      const drop = new Set((sessionOptions ?? []).filter((s) => s.projectId === id).map((s) => s.id))
      setCheckedSessions((prev) => new Set([...prev].filter((sid) => !drop.has(sid))))
    }
  }

  // 담당자·평가위원 모두 참여 사업 안의 분과만 노출(사업 미선택 시 안내)
  const visibleSessions = canSetProjects
    ? (sessionOptions ?? []).filter((s) => s.projectId && checkedProjects.has(s.projectId))
    : sessionOptions ?? []
  const sessionGroups = new Map<string, { id: string; label: string }[]>()
  for (const s of visibleSessions) {
    const key = s.group ?? '기타'
    if (!sessionGroups.has(key)) sessionGroups.set(key, [])
    sessionGroups.get(key)!.push({ id: s.id, label: s.label })
  }

  // 상태(유효/진행)를 상단 버튼 행에 반영
  useEffect(() => {
    onStatus({ valid: name.trim() !== '', busy: pending })
  }, [name, pending, onStatus])

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
      // 사업 → 분과 순으로 반영(참여 사업 저장 후 그 안의 분과 배정)
      if (canSetProjects) {
        const pres = await setProjectsAction!(user.id, [...checkedProjects])
        if (!pres.ok) {
          setError(pres.error ?? '사업 설정에 실패했습니다.')
          return
        }
      }
      if (canAssign) {
        const validSessions = canSetProjects
          ? [...checkedSessions].filter((sid) =>
              (sessionOptions ?? []).some((s) => s.id === sid && s.projectId && checkedProjects.has(s.projectId)),
            )
          : [...checkedSessions]
        const ares = await setSessionsAction!(user.id, validSessions)
        if (!ares.ok) {
          setError(ares.error ?? '분과 배정에 실패했습니다.')
          return
        }
      }
      onSaved()
    })
  }
  useImperativeHandle(ref, () => ({ submit: save }))

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

      {/* 1단계: 참여 사업 선택(담당자·평가위원 공통) */}
      {canSetProjects && (
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">참여 사업</span>
            <span className="text-xs text-slate-400">{checkedProjects.size}개 선택</span>
          </div>
          {projectOptions!.length === 0 ? (
            <p className="text-xs text-slate-400">등록된 사업이 없습니다.</p>
          ) : (
            <div className="thin-scrollbar max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {projectOptions!.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checkedProjects.has(p.id)}
                    onChange={() => toggleProject(p.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700">{p.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2단계: 선택한 사업의 분과 배정 */}
      {canAssign && (
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">분과 배정</span>
            <span className="text-xs text-slate-400">{checkedSessions.size}개 선택</span>
          </div>
          {canSetProjects && checkedProjects.size === 0 ? (
            <p className="text-xs text-amber-600">먼저 위에서 참여 사업을 선택하세요.</p>
          ) : visibleSessions.length === 0 ? (
            <p className="text-xs text-slate-400">배정 가능한 분과가 없습니다.</p>
          ) : (
            <div className="thin-scrollbar max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {[...sessionGroups.entries()].map(([group, opts]) => (
                <div key={group}>
                  <div className="px-1 py-0.5 text-xs font-semibold text-slate-400">{group}</div>
                  {opts.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checkedSessions.has(o.id)}
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
    </div>
  )
})

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
// 칩 목록 셀. 비어 있고 onSet이 있으면 밑줄 텍스트 '설정'을 보여 배정 모달을 연다.
// 이미 배정(칩)이 있으면 '설정'은 숨기고 칩만 표시(수정은 '정보 변경'에서).
// '설정'은 stopPropagation으로 행 체크박스 토글을 막는다.
// 행 끝 수정·삭제 아이콘 — 행 클릭(선택)으로 번지지 않게 전파 차단
function RowActionsCell({
  rowSpan,
  onEdit,
  onDelete,
  borderCls = 'border-b border-slate-100',
}: {
  rowSpan: number
  onEdit: () => void
  onDelete: () => void
  borderCls?: string
}) {
  return (
    <td rowSpan={rowSpan} className={`${borderCls} px-4 py-2.5`}>
      <span className="flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="수정"
          title="수정"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="text-slate-400 transition hover:text-indigo-600"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 3.5 16.5 6.5 7 16H4v-3z" />
            <path d="m11.8 5.2 3 3" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="삭제"
          title="삭제"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-slate-400 transition hover:text-rose-600"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 5.5h13" />
            <path d="M8 5.5V4h4v1.5" />
            <path d="M5.5 5.5 6.3 16h7.4l.8-10.5" />
            <path d="M8.5 8.5v5M11.5 8.5v5" />
          </svg>
        </button>
      </span>
    </td>
  )
}

// 셀 안 '설정' 진입 링크 — 행 클릭(선택)으로 번지지 않게 전파 차단
function SetLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="text-xs font-medium text-indigo-600 underline underline-offset-2 transition hover:text-indigo-700"
    >
      {label}
    </button>
  )
}

function ChipCell({
  chips,
  emptyLabel,
  onSet,
  setLabel = '설정',
}: {
  chips: { label: string; href?: string }[]
  emptyLabel: string
  onSet?: () => void
  setLabel?: string
}) {
  return (
    <td className="border-b border-slate-100 px-4 py-2.5">
      {chips.length === 0 ? (
        <span className="flex justify-center">
          {onSet ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSet()
              }}
              className="text-xs font-medium text-indigo-600 underline underline-offset-2 transition hover:text-indigo-700"
            >
              {setLabel}
            </button>
          ) : (
            <span className="text-xs text-slate-400">{emptyLabel}</span>
          )}
        </span>
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
