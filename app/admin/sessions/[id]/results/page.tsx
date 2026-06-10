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
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">집계 결과 · {session?.name}</h1>
        <div className="flex gap-2">
          <a href={`/api/sessions/${id}/results.csv`} className="rounded border px-4 py-2">CSV 다운로드</a>
          <PrintButton />
        </div>
      </div>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">순위</th><th className="p-2">대상</th><th className="p-2">최종 점수</th></tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={r.subjectId} className="border-t">
              <td className="p-2">{r.rank}</td>
              <td className="p-2">{subjectName.get(r.subjectId)}</td>
              <td className="p-2 font-semibold">{r.finalScore.toFixed(2)}</td>
            </tr>
          ))}
          {ranked.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">집계할 점수가 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
