import { prisma } from '@/lib/db'
import { computeFinalScores, rankSubjects } from '@/lib/scoring'
import PrintButton from './PrintButton'

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const subjects = await prisma.subject.findMany({ where: { sessionId: id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id } })
  const scores = await prisma.score.findMany({ where: { sessionId: id } })

  const finalScores = computeFinalScores(
    scores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })),
    criteria.map((c) => ({ id: c.id, weight: c.weight })),
  )
  const ranked = rankSubjects(finalScores)
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">위원 평균 가중 점수 기준 순위입니다.</p>
        <div className="flex gap-2">
          <a href={`/api/sessions/${id}/results.csv`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
            CSV 다운로드
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="mb-1 text-xl font-bold">심사 총괄표 · {session?.name}</h1>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">순위</th>
              <th className="px-5 py-3 font-medium">대상</th>
              <th className="px-5 py-3 font-medium text-right">최종 점수</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.subjectId} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    r.rank === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {r.rank}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-slate-800">{subjectName.get(r.subjectId)}</td>
                <td className="px-5 py-3 text-right text-lg font-bold text-slate-900">{r.finalScore.toFixed(2)}</td>
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-12 text-center text-slate-400">집계할 점수가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
