import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { GRADE_RATIOS } from '@/lib/scoring'
import ScoreForm, { type CriterionView } from './ScoreForm'

export default async function ScoreSheet({ params }: { params: Promise<{ sessionId: string; subjectId: string }> }) {
  const { sessionId, subjectId } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { documents: { orderBy: { createdAt: 'asc' } } },
  })
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
  if (!subject) notFound()

  const existing = await prisma.score.findMany({ where: { evaluatorId: user.id, subjectId } })
  const byCriterion = new Map(existing.map((s) => [s.criterionId, s]))

  const criteriaView: CriterionView[] = criteria.map((c) => {
    const cur = byCriterion.get(c.id)
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      maxScore: c.maxScore,
      weight: c.weight,
      value: cur ? cur.value : null,
      grade: cur?.grade ?? null,
    }
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/evaluate" className="text-sm text-slate-400 hover:text-slate-600">← 대상 목록</Link>
        <h1 className="mt-1 text-2xl font-bold">{subject.name}</h1>
        {session && <p className="text-sm text-slate-500">{session.name}</p>}
      </div>
      {subject.documents.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-slate-700">심사 서류</div>
          <ul className="space-y-1">
            {subject.documents.map((d) => (
              <li key={d.id}>
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                  <span>📄</span>{d.originalName}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">새 탭에서 서류를 열어 검토하며 점수를 입력하세요.</p>
        </div>
      )}

      <ScoreForm sessionId={sessionId} subjectId={subjectId} criteria={criteriaView} gradeRatios={GRADE_RATIOS} />
    </div>
  )
}
