'use client'

import { useState } from 'react'
import SubjectScoresDetail from '@/components/SubjectScoresDetail'

export type OverallRankRow = {
  id: string
  // 전 분과 통합 순위 — 미집계 대상도 순번을 이어받는다. 분과 필터를 걸어도 통합 순위 그대로.
  rank: number
  name: string
  sessionId: string
  sessionName: string
  score: number | null // null = 미집계
  isTop: boolean // 통합 1위(공동 1위 포함)
  secretaryName: string | null
  submitted: boolean // 담당자 제출 여부
  chairOpinion: { name: string; text: string } | null
  evaluators: { name: string; isChair: boolean; score: number; opinion: string | null }[]
}

const PAGE_SIZE = 10

// 사업 집계 결과의 전체 순위 표 — 분과 필터 + 10개씩 페이지네이션.
export default function OverallRankingTable({
  rows,
  sessions,
}: {
  rows: OverallRankRow[]
  sessions: { id: string; name: string }[]
}) {
  const [sessionFilter, setSessionFilter] = useState('')
  const [page, setPage] = useState(0)

  const filtered = sessionFilter ? rows.filter((r) => r.sessionId === sessionFilter) : rows
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pageCount - 1)
  const visible = filtered.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="space-y-2">
      {/* 상단 우측: 분과 필터 */}
      <div className="flex items-center justify-end">
        {/* 분과 필터 — 우측 고정, 관리 테이블 공용 스타일 셀렉트 */}
        <div className="relative">
          <select
            value={sessionFilter}
            onChange={(e) => {
              setSessionFilter(e.target.value)
              setPage(0)
            }}
            aria-label="분과 필터"
            className="h-9 appearance-none rounded-lg border border-slate-300 bg-white pr-8 pl-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
          >
            <option value="">전체 분과</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400">
            ▾
          </span>
        </div>

      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">
            {rows.length === 0 ? '등록된 평가 대상이 없습니다.' : '이 분과에 평가 대상이 없습니다.'}
          </p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="w-20 px-5 py-2.5 font-medium">순위</th>
                <th className="px-5 py-2.5 font-medium">기업명</th>
                <th className="px-5 py-2.5 font-medium">분과</th>
                <th className="px-5 py-2.5 font-medium">담당자</th>
                <th className="px-5 py-2.5 font-medium">담당자 제출</th>
                <th className="w-32 px-5 py-2.5 text-right font-medium">점수</th>
                <th className="w-40 px-5 py-2.5 font-medium">위원장 종합의견</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-50 last:border-0 ${r.isTop ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-slate-50/60'}`}
                >
                  <td className="px-5 py-2.5 tabular-nums">
                    <span className={r.isTop ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}>{r.rank}</span>
                  </td>
                  <td className={`px-5 py-2.5 ${r.isTop ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{r.name}</td>
                  <td className="px-5 py-2.5 text-slate-600">{r.sessionName}</td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {r.secretaryName ?? <span className="text-xs text-rose-600">미배정</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    {/* 분과별 검토 현황과 같은 표기 — 제출=검정, 미제출=빨강 */}
                    {r.submitted ? (
                      <span className="text-xs whitespace-nowrap text-slate-900">제출</span>
                    ) : (
                      <span className="text-xs whitespace-nowrap text-rose-600">미제출</span>
                    )}
                  </td>
                  <td className={`px-5 py-2.5 text-right tabular-nums ${r.isTop ? 'font-bold text-indigo-700' : 'font-medium text-slate-800'}`}>
                    {r.score != null ? r.score.toFixed(2) : <span className="font-normal text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <SubjectScoresDetail
                      subjectName={r.name}
                      buttonLabel="종합의견"
                      chairOpinion
                      note="평가위원장이 작성한 종합의견입니다."
                      emptyMessage="평가위원장 종합의견이 없습니다."
                      chairOpinionOf={r.chairOpinion}
                      evaluators={r.evaluators}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 하단: 가운데 페이지네이션 + 오른쪽 표시 범위 */}
      <div className="relative flex items-center justify-center">
        {/* 페이지네이션 — 10개씩. 1페이지뿐이어도 항상 노출 */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={cur === 0}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`min-w-7 rounded-md px-2 py-1 text-xs font-medium transition ${
                  i === cur ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={cur === pageCount - 1}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
        {filtered.length > 0 && (
          <p className="absolute right-0 text-xs text-slate-400">
            {filtered.length}개 대상 중 {cur * PAGE_SIZE + 1}–{Math.min((cur + 1) * PAGE_SIZE, filtered.length)} 표시
          </p>
        )}
      </div>
    </div>
  )
}
