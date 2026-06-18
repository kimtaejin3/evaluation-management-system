'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ChairSummaryForm from '@/components/ChairSummaryForm'
import ChairScoreCell from '@/components/ChairScoreCell'
import { SkeletonTable } from '@/components/Skeletons'
import type { ChairData } from '@/lib/evaluate-data'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function ChairClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [data, setData] = useState<ChairData | null>(null)

  useEffect(() => {
    let ignore = false
    fetch(`/api/evaluate/chair?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => {
        if (r.status === 403) { router.replace('/evaluate'); return null } // 위원장 아님
        return r.ok ? r.json() : Promise.reject(r.status)
      })
      .then((d: ChairData | null) => { if (!ignore && d) setData(d) })
      .catch(() => { if (!ignore) router.replace('/evaluate') })
    return () => { ignore = true }
  }, [sessionId, router])

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/evaluate" className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50">← 대상 목록</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{data?.sessionName ?? ' '}</h1>
          <p className="mt-0.5 text-sm text-slate-500">위원장 총괄평가 · 위원별 점수 열람</p>
        </div>
      </div>

      {!data ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium">대상</th>
                  {data.evaluators.map((e) => (
                    <th key={e.id} className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                      {e.name}
                      {e.isChair && <span className="ml-1 text-xs text-indigo-600">(위원장)</span>}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-medium">평균</th>
                  <th className="px-4 py-2.5 text-center font-medium">순위</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.subjectId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.subjectName}</td>
                    {row.cells.map((c, j) => (
                      <td key={data.evaluators[j].id} className="px-2 py-2 text-right tabular-nums">
                        <ChairScoreCell
                          evaluatorName={data.evaluators[j].name}
                          subjectName={row.subjectName}
                          isChair={data.evaluators[j].isChair}
                          state={c.state}
                          score={c.score}
                          items={c.items}
                          opinion={c.opinion}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-indigo-700">
                      {row.avg != null ? fmt(row.avg) : <span className="text-xs font-normal text-slate-400">집계 전</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.rank != null ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{row.rank}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={data.evaluators.length + 3} className="px-4 py-10 text-center text-slate-400">평가 대상이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">· 각 칸: 입력전 / 입력중 / 합계 점수(모든 항목 완료 시) — 칸을 클릭하면 항목별 입력 현황을 볼 수 있습니다. · 평균/순위는 완료 위원 기준 잠정값입니다.</p>
          <ChairSummaryForm sessionId={sessionId} initial={data.chairSummary} />
        </>
      )}
    </div>
  )
}
