'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PasswordCell from '@/components/PasswordCell'
import { assignEvaluator, removeEvaluator } from '@/app/admin/sessions/actions'

export type EvaluatorSessionGroup = {
  id: string
  name: string
  chairId: string | null
  closed: boolean // 마감(CLOSED) — 배정 편집 불가
  assignments: {
    id: string
    userId: string
    name: string
    username: string
    phone: string | null
    tempPassword: string | null
  }[]
}

// 평가위원 선정현황 표 — 분과별 묶음(rowSpan) + 분과 중심 배정 편집.
// 마지막 열('추가 및 삭제')에서 행 끝 ✕ 로 배정 해제하고, 분과 그룹 끝의 + 로 위원을 추가한다
// (한 명씩 미세 조정용 — 일괄 배정은 평가위원 관리에서).
export default function ProjectEvaluatorsTable({
  sessions,
  pool,
}: {
  sessions: EvaluatorSessionGroup[]
  pool: { id: string; name: string; username: string }[]
}) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  // 배정 해제 확인 대상 — { sessionId, userId } (인라인 confirm 모달)
  const [removeTarget, setRemoveTarget] = useState<{ sessionId: string; userId: string } | null>(null)
  // 위원 추가 대상 분과 — + 클릭 시 후보 목록 모달
  const [addTarget, setAddTarget] = useState<string | null>(null)

  const assign = (sessionId: string, userId: string) => {
    if (!userId) return
    startTx(async () => {
      const fd = new FormData()
      fd.set('userId', userId)
      await assignEvaluator(sessionId, fd)
      router.refresh()
    })
  }
  const confirmRemove = () => {
    if (!removeTarget) return
    startTx(async () => {
      await removeEvaluator(removeTarget.sessionId, removeTarget.userId)
      setRemoveTarget(null)
      router.refresh()
    })
  }

  // 이 사업 안에서 하나라도 배정된 위원 — 후보 목록 그룹 구분용
  const assignedAnywhere = new Set(sessions.flatMap((s) => s.assignments.map((a) => a.userId)))
  // 분과별 추가 후보(아직 그 분과에 배정되지 않은 위원) — 미배정 위원을 먼저 보여준다
  const candidatesOf = (s: EvaluatorSessionGroup) => {
    const assignedIds = new Set(s.assignments.map((a) => a.userId))
    const candidates = pool.filter((p) => !assignedIds.has(p.id))
    return {
      all: candidates,
      unassigned: candidates.filter((p) => !assignedAnywhere.has(p.id)),
      elsewhere: candidates.filter((p) => assignedAnywhere.has(p.id)),
    }
  }

  const removeSession = sessions.find((s) => s.id === removeTarget?.sessionId)
  const removeUser = removeSession?.assignments.find((a) => a.userId === removeTarget?.userId)
  const addSession = sessions.find((s) => s.id === addTarget)
  const addCandidates = addSession ? candidatesOf(addSession) : null

  return (
    <div className="space-y-2">
      {/* 범례 — 위원장 행 배경색 안내 */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 rounded-sm border border-indigo-200 bg-indigo-50/70" aria-hidden />
          위원장
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-medium">분과명</th>
                <th className="px-5 py-3 font-medium">위원명</th>
                <th className="px-5 py-3 font-medium">아이디</th>
                <th className="px-5 py-3 font-medium">비밀번호</th>
                <th className="px-5 py-3 font-medium">연락처</th>
                <th className="w-28 px-3 py-3 text-center font-medium whitespace-nowrap">추가 및 삭제</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const { all: candidates } = candidatesOf(s)
                // 위원 행들 + (마감 아니면) 마지막 '+' 행
                const rows = s.assignments.length + (s.closed ? 0 : 1) || 1
                const head = (
                  <td rowSpan={rows} className="border-r border-slate-100 px-5 py-3 align-top">
                    <Link
                      href={`/admin/sessions/${s.id}/evaluators`}
                      className="font-medium text-slate-800 hover:text-indigo-700 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.closed && <p className="mt-0.5 text-xs text-slate-400">마감 — 변경 불가</p>}
                  </td>
                )
                const memberRows = s.assignments.map((a, i) => {
                  const isChair = a.userId === s.chairId
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-slate-50 last:border-0 ${isChair ? 'bg-indigo-50/70' : ''}`}
                      title={isChair ? '위원장' : undefined}
                    >
                      {i === 0 && head}
                      <td className={`px-5 py-3 ${isChair ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
                        {/* 위원장은 배경색에 더해 이름 앞 뱃지로도 표시 */}
                        {isChair && (
                          <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                            위원장
                          </span>
                        )}
                        {a.name}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.username}</td>
                      <td className="px-5 py-3">
                        <PasswordCell value={a.tempPassword} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.phone ?? '—'}</td>
                      <td className="px-3 py-3 text-center">
                        {!s.closed && (
                          <button
                            type="button"
                            aria-label={`${a.name} 배정 해제`}
                            title="배정 해제"
                            disabled={pending}
                            onClick={() => setRemoveTarget({ sessionId: s.id, userId: a.userId })}
                            className="text-slate-300 transition hover:text-rose-600 disabled:opacity-40"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
                // 그룹 끝 행 — 마지막 열에 + (위원 추가). 마감 분과는 + 없이 빈 안내만.
                const tailRow = !s.closed ? (
                  <tr key={`${s.id}-add`} className="border-b border-slate-50 last:border-0">
                    {s.assignments.length === 0 && head}
                    <td colSpan={4} className="px-5 py-2 text-xs text-slate-400">
                      {s.assignments.length === 0 ? '배정된 위원 없음' : ''}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        aria-label={`${s.name} 위원 추가`}
                        title={candidates.length === 0 ? '추가할 위원 없음' : '위원 추가'}
                        disabled={pending || candidates.length === 0}
                        onClick={() => setAddTarget(s.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-sm leading-none text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                ) : s.assignments.length === 0 ? (
                  <tr key={`${s.id}-empty`} className="border-b border-slate-50 last:border-0">
                    {head}
                    <td colSpan={5} className="px-5 py-3 text-sm text-slate-400">
                      배정된 위원 없음
                    </td>
                  </tr>
                ) : null
                return [...memberRows, tailRow]
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 위원 추가 모달 — 후보를 누르면 바로 배정. 여러 명을 이어서 추가할 수 있게 열어 둔다. */}
      {addSession && addCandidates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setAddTarget(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                위원 추가 <span className="ml-1 text-sm font-normal text-slate-500">· {addSession.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddTarget(null)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <div className="overflow-y-auto px-2 py-2">
              {addCandidates.all.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">추가할 위원이 없습니다.</p>
              ) : (
                (
                  [
                    ['미배정 위원', addCandidates.unassigned],
                    ['다른 분과 배정됨', addCandidates.elsewhere],
                  ] as const
                ).map(([label, list]) =>
                  list.length === 0 ? null : (
                    <div key={label} className="mb-1">
                      <p className="px-3 pt-2 pb-1 text-xs font-medium text-slate-400">{label}</p>
                      <ul>
                        {list.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => assign(addSession.id, p.id)}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-indigo-50 disabled:opacity-50"
                            >
                              <span>
                                <span className="font-medium text-slate-800">{p.name}</span>
                                <span className="ml-2 text-xs text-slate-400">{p.username}</span>
                              </span>
                              <span className="text-xs font-medium text-indigo-600">{pending ? '처리 중…' : '+ 추가'}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* 배정 해제 확인 모달 */}
      {removeTarget && removeUser && removeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setRemoveTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">배정 해제</h3>
            <p className="text-sm text-slate-600">
              <b className="text-slate-800">{removeUser.name}</b> 위원을 ‘{removeSession.name}’에서 배정 해제할까요?
              {removeUser.userId === removeSession.chairId && ' 위원장 지정도 함께 해제됩니다.'}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRemoveTarget(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                취소
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={pending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? '해제 중…' : '배정 해제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
