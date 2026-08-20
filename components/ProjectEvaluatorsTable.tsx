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
// 각 분과 그룹 끝의 '+ 위원 추가' 드롭다운으로 전역 풀에서 골라 배정하고,
// 행 끝 ✕ 로 배정 해제한다(한 명씩 미세 조정용 — 일괄 배정은 평가위원 관리에서).
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

  // 이 사업 안에서 하나라도 배정된 위원 — 드롭다운 그룹 구분용
  const assignedAnywhere = new Set(sessions.flatMap((s) => s.assignments.map((a) => a.userId)))

  const removeSession = sessions.find((s) => s.id === removeTarget?.sessionId)
  const removeUser = removeSession?.assignments.find((a) => a.userId === removeTarget?.userId)

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
                <th className="w-14 px-5 py-3" aria-label="배정 해제" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                // 이 분과에 아직 배정되지 않은 위원만 추가 후보로.
                // 어느 분과에도 배정 안 된 위원을 먼저(그룹 구분) 보여준다.
                const assignedIds = new Set(s.assignments.map((a) => a.userId))
                const candidates = pool.filter((p) => !assignedIds.has(p.id))
                const unassigned = candidates.filter((p) => !assignedAnywhere.has(p.id))
                const elsewhere = candidates.filter((p) => assignedAnywhere.has(p.id))
                // 위원 행들 + (마감 아니면) 마지막 '+ 위원 추가' 행
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
                        {a.name}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.username}</td>
                      <td className="px-5 py-3">
                        <PasswordCell value={a.tempPassword} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{a.phone ?? '—'}</td>
                      <td className="px-5 py-3 text-center">
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
                const addRow = !s.closed ? (
                  <tr key={`${s.id}-add`} className="border-b border-slate-50 last:border-0">
                    {s.assignments.length === 0 && head}
                    <td colSpan={5} className="px-5 py-2.5">
                      <span className="relative inline-block">
                        <select
                          value=""
                          disabled={pending || candidates.length === 0}
                          aria-label={`${s.name} 위원 추가`}
                          onChange={(e) => assign(s.id, e.target.value)}
                          className="h-8 appearance-none rounded-lg border border-dashed border-slate-300 bg-white py-0 pr-7 pl-2.5 text-xs text-slate-500 transition hover:border-slate-400 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">{candidates.length === 0 ? '추가할 위원 없음' : '+ 위원 추가'}</option>
                          {unassigned.length > 0 && (
                            <optgroup label="미배정 위원">
                              {unassigned.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} · {p.username}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {elsewhere.length > 0 && (
                            <optgroup label="다른 분과 배정됨">
                              {elsewhere.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} · {p.username}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <span aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-slate-400">
                          ▾
                        </span>
                      </span>
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
                return [...memberRows, addRow]
              })}
            </tbody>
          </table>
        )}
      </div>

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
