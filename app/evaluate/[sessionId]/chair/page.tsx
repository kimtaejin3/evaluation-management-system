import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { computeWeightedScore } from '@/lib/scoring'
import ChairSummaryForm from '@/components/ChairSummaryForm'
import ChairScoreCell from '@/components/ChairScoreCell'
import { SkeletonTable } from '@/components/Skeletons'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default async function ChairPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session) notFound()
  // 위원장 본인만 접근
  if (session.chairId !== user.id) redirect('/evaluate')

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/evaluate" className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50">← 대상 목록</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{session.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">위원장 총괄평가 · 위원별 점수 열람</p>
        </div>
      </div>

      <Suspense fallback={<SkeletonTable rows={5} cols={5} />}>
        <ChairTable sessionId={sessionId} chairId={session.chairId} />
      </Suspense>
      <p className="text-xs text-slate-400">· 각 칸: 입력전 / 입력중 / 합계 점수(모든 항목 완료 시) — 칸을 클릭하면 항목별 입력 현황을 볼 수 있습니다. · 평균/순위는 완료 위원 기준 잠정값입니다.</p>

      <ChairSummaryForm sessionId={sessionId} initial={session.chairSummary ?? ''} />
    </div>
  )
}

async function ChairTable({ sessionId, chairId }: { sessionId: string; chairId: string | null }) {
  const [subjects, criteria, assignments, scores, opinions] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true, maxScore: true, weight: true } }),
    prisma.assignment.findMany({ where: { sessionId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true, value: true } }),
    prisma.opinion.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, text: true } }),
  ])

  const weights = criteria.map((c) => ({ id: c.id, weight: c.weight }))
  const totalCri = criteria.length

  // 위원장을 컬럼 맨 앞으로
  const orderedAssignments = [...assignments].sort(
    (a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0),
  )

  // (evaluator, subject) → rows
  const byEvalSub = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of scores) {
    const k = `${s.evaluatorId}:${s.subjectId}`
    if (!byEvalSub.has(k)) byEvalSub.set(k, [])
    byEvalSub.get(k)!.push({ criterionId: s.criterionId, value: s.value })
  }
  // (evaluator:subject:criterion) → value (모달 항목별 표시용)
  const scoreMap = new Map<string, number>()
  for (const s of scores) scoreMap.set(`${s.evaluatorId}:${s.subjectId}:${s.criterionId}`, s.value)
  const itemsOf = (evId: string, subId: string) =>
    criteria.map((c) => ({ name: c.name, maxScore: c.maxScore, value: scoreMap.get(`${evId}:${subId}:${c.id}`) ?? null }))
  // (evaluator:subject) → 종합의견
  const opinionMap = new Map<string, string>()
  for (const o of opinions) opinionMap.set(`${o.evaluatorId}:${o.subjectId}`, o.text)

  type CellInfo = { state: 'done' | 'partial' | 'none'; score: number | null }
  const cellOf = (evId: string, subId: string): CellInfo => {
    const rows = byEvalSub.get(`${evId}:${subId}`) ?? []
    if (totalCri > 0 && rows.length >= totalCri) return { state: 'done', score: computeWeightedScore(rows, weights) }
    return { state: rows.length > 0 ? 'partial' : 'none', score: null }
  }

  // 대상별 완료 위원 평균(잠정) + 순위
  const subjAvg = subjects.map((sub) => {
    const totals: number[] = []
    for (const a of assignments) {
      const c = cellOf(a.userId, sub.id)
      if (c.state === 'done' && c.score != null) totals.push(c.score)
    }
    const avg = totals.length ? totals.reduce((x, y) => x + y, 0) / totals.length : null
    return { id: sub.id, name: sub.name, avg, completeCount: totals.length }
  })
  const sortedAvg = [...subjAvg].filter((s) => s.avg != null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
  const rankMap = new Map<string, number>()
  sortedAvg.forEach((s, i) => {
    const rank = i > 0 && sortedAvg[i - 1].avg === s.avg ? rankMap.get(sortedAvg[i - 1].id)! : i + 1
    rankMap.set(s.id, rank)
  })

  return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium">대상</th>
              {orderedAssignments.map((a) => (
                <th key={a.userId} className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                  {a.user.name}
                  {a.userId === chairId && <span className="ml-1 text-xs text-indigo-600">(위원장)</span>}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">평균</th>
              <th className="px-4 py-2.5 text-center font-medium">순위</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub) => {
              const info = subjAvg.find((s) => s.id === sub.id)!
              const rank = rankMap.get(sub.id) ?? null
              return (
                <tr key={sub.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{sub.name}</td>
                  {orderedAssignments.map((a) => {
                    const c = cellOf(a.userId, sub.id)
                    return (
                      <td key={a.userId} className="px-2 py-2 text-right tabular-nums">
                        <ChairScoreCell
                          evaluatorName={a.user.name}
                          subjectName={sub.name}
                          isChair={a.userId === chairId}
                          state={c.state}
                          score={c.score}
                          items={itemsOf(a.userId, sub.id)}
                          opinion={opinionMap.get(`${a.userId}:${sub.id}`) ?? null}
                        />
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-indigo-700">
                    {info.avg != null ? fmt(info.avg) : <span className="text-xs font-normal text-slate-400">집계 전</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rank != null ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{rank}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={assignments.length + 3} className="px-4 py-10 text-center text-slate-400">평가 대상이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
  )
}
