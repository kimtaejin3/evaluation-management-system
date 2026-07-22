'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ReviewStatusBadge from './ReviewStatusBadge'
import ReviewDecisionButtons from './ReviewDecisionButtons'

export interface ProjectSubjectRow {
  sessionId: string
  name: string
  secretaryName: string | null
  reviewStatus: string
  subjectCount: number
  evaluators: { id: string; name: string }[]
  subjects: { id: string; name: string }[]
  // `${evaluatorId}:${subjectId}` → 총점(전 항목 입력 시에만 산출, 아니면 null)
  totals: Record<string, number | null>
  // 간사가 평가위원 배정을 제출하기 전 — 관리자에게 위원 명단(점수 매트릭스)을 숨긴다
  evaluatorsHidden?: boolean
}

// 점수 보기 모달 — 평가 대상별 점수(채점 완료 위원의 총점 평균)
function ScoresModal({ row, onClose }: { row: ProjectSubjectRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">{row.name} — 평가 대상별 점수</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="닫기">
            ✕
          </button>
        </div>

        {row.evaluatorsHidden ? (
          <p className="py-6 text-center text-sm text-slate-400">
            간사가 평가위원 배정을 제출하기 전에는 점수가 표시되지 않습니다.
          </p>
        ) : row.subjects.length === 0 || row.evaluators.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            {row.subjects.length === 0 ? '등록된 평가 대상이 없습니다.' : '배정된 평가위원이 없습니다.'}
          </p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 font-medium">평가 대상</th>
                <th className="px-3 py-2 text-right font-medium">채점 완료 위원</th>
                <th className="px-3 py-2 text-right font-medium">평균 점수</th>
              </tr>
            </thead>
            <tbody>
              {row.subjects.map((sub) => {
                const vals = row.evaluators.map((e) => row.totals[`${e.id}:${sub.id}`] ?? null)
                const done = vals.filter((v): v is number => v !== null)
                const avg = done.length ? done.reduce((a, b) => a + b, 0) / done.length : null
                return (
                  <tr key={sub.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 text-slate-800">{sub.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {done.length}/{row.evaluators.length}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                      {avg !== null ? avg.toFixed(2) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// 과제 평가대상 — 분과 단위 행. 분과명 클릭 → 분과 평가 대상 페이지(기업 자료 제출 조회),
// '점수 보기' → 대상×위원 점수 매트릭스 모달, '자세히 보기' → 분과 상세의 평가 대상 페이지.
export default function ProjectSubjectsTable({
  rows,
  isMaster,
}: {
  rows: ProjectSubjectRow[]
  isMaster: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openRow = rows.find((r) => r.sessionId === openId) ?? null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">아직 분과가 없습니다.</p>
      ) : (
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-5 py-3 font-medium">분과명</th>
              <th className="px-5 py-3 font-medium">담당 간사</th>
              <th className="px-5 py-3 font-medium">간사 제출</th>
              <th className="px-5 py-3 font-medium">평가 대상 수</th>
              <th className="px-5 py-3 font-medium">점수</th>
              <th className="px-5 py-3 font-medium">자세히 보기</th>
              <th className="px-5 py-3 font-medium">승인 상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sessionId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3">
                  {/* 이동은 '자세히 보기'로 — 분과명은 일반 텍스트 */}
                  <span className="font-medium text-slate-800">{r.name}</span>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {r.secretaryName ?? <span className="text-xs text-rose-600">미배정</span>}
                </td>
                <td className="px-5 py-3">
                  <ReviewStatusBadge status={r.reviewStatus} />
                </td>
                <td className="px-5 py-3 text-slate-600">{r.subjectCount}</td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(r.sessionId)}
                    className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                  >
                    점수 보기
                  </button>
                </td>
                <td className="px-5 py-3">
                  {/* 분과 상세의 평가 대상 페이지로 이동 (실시간 모니터링의 자세히 보기와 동일 패턴) */}
                  <Link
                    href={`/admin/sessions/${r.sessionId}/subjects`}
                    className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                  >
                    자세히 보기
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* 상태 배지는 표시하지 않음 — 승인/반려 버튼으로만 판단 */}
                    {isMaster && (
                      <ReviewDecisionButtons sessionId={r.sessionId} status={r.reviewStatus} kind="subjects" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openRow && <ScoresModal row={openRow} onClose={() => setOpenId(null)} />}
    </div>
  )
}
