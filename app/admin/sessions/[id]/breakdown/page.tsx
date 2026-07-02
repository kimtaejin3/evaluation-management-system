import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { computeWeightedScore } from '@/lib/scoring'
import { SkeletonTable } from '@/components/Skeletons'

export default async function BreakdownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <SkeletonTable rows={5} cols={5} />
          <SkeletonTable rows={4} cols={4} />
        </div>
      }
    >
      <BreakdownContent id={id} />
    </Suspense>
  )
}

async function BreakdownContent({ id }: { id: string }) {
  const [session, subjects, criteria, assignments, scores] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id }, select: { chairId: true } }),
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } }),
    prisma.criterion.findMany({
      where: { sessionId: id },
      include: { subitem: { include: { group: true } } },
      orderBy: [
        { subitem: { group: { order: 'asc' } } },
        { subitem: { order: 'asc' } },
        { order: 'asc' },
      ],
    }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: true } }),
    prisma.score.findMany({ where: { sessionId: id } }),
  ])
  const chairId = session?.chairId ?? null

  const weightedCriteria = criteria.map((c) => ({ id: c.id, weight: c.weight }))
  // (ev, sub) -> rows
  const rowsByEvSub = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of scores) {
    const key = `${s.evaluatorId}:${s.subjectId}`
    if (!rowsByEvSub.has(key)) rowsByEvSub.set(key, [])
    rowsByEvSub.get(key)!.push({ criterionId: s.criterionId, value: s.value })
  }

  const weightedFor = (evId: string, subId: string): number | null => {
    const rows = rowsByEvSub.get(`${evId}:${subId}`)
    if (!rows || rows.length === 0) return null
    return computeWeightedScore(rows, weightedCriteria)
  }

  // 위원장을 맨 앞으로
  const evaluators = [...assignments]
    .sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))
    .map((a) => a.user)

  return (
    <div className="space-y-8">
      {/* 위원별 점수표 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-700">위원별 점수</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 font-medium">대상</th>
                {evaluators.map((e) => (
                  <th key={e.id} className="px-4 py-3 text-right font-medium">
                    {e.name}
                    {e.id === chairId && <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">위원장</span>}
                  </th>
                ))}
                <th className="px-5 py-3 text-right font-medium">평균(최종)</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub) => {
                const vals = evaluators.map((e) => weightedFor(e.id, sub.id))
                const present = vals.filter((v): v is number => v !== null)
                const avg = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null
                return (
                  <tr key={sub.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800">{sub.name}</td>
                    {vals.map((v, i) => (
                      <td key={evaluators[i].id} className="px-4 py-3 text-right text-slate-600">
                        {v === null ? '—' : v.toFixed(1)}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{avg === null ? '—' : avg.toFixed(2)}</td>
                  </tr>
                )
              })}
              {subjects.length === 0 && (
                <tr><td colSpan={evaluators.length + 2} className="px-5 py-10 text-center text-slate-400">데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 산출 근거표 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-700">산출 근거 (대상별 항목 평균)</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {subjects.map((sub) => {
            // 항목별 위원 평균 점수 (평가항목 · 세부항목 · 항목명 순으로 표시)
            const rows = criteria.map((c) => {
              const vs = scores.filter((s) => s.subjectId === sub.id && s.criterionId === c.id).map((s) => s.value)
              const avg = vs.length > 0 ? vs.reduce((a, b) => a + b, 0) / vs.length : 0
              const groupName = c.subitem?.group.name
              const subitemName = c.subitem?.name
              const label = [groupName, subitemName, c.name].filter(Boolean).join(' · ')
              return { name: label, maxScore: c.maxScore, weight: c.weight, avg, weighted: avg * c.weight }
            })
            const total = rows.reduce((sum, r) => sum + r.weighted, 0)
            return (
              <div key={sub.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3 font-medium text-slate-800">{sub.name}</div>
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2 font-medium">항목</th>
                      <th className="px-3 py-2 text-right font-medium">평균/배점</th>
                      <th className="px-4 py-2 text-right font-medium">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 text-slate-700">{r.name}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{r.avg.toFixed(1)} / {r.maxScore}</td>
                        <td className="px-4 py-2 text-right font-medium text-slate-800">{r.weighted.toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 font-semibold text-slate-700" colSpan={2}>최종 점수</td>
                      <td className="px-4 py-2 text-right font-bold text-indigo-600">{total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
          {subjects.length === 0 && <p className="text-sm text-slate-400">데이터가 없습니다.</p>}
        </div>
      </section>
    </div>
  )
}
