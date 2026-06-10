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

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
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
    <div className="max-w-2xl space-y-6">
      <Link href="/evaluate" className="text-sm text-blue-600">← 대상 목록</Link>
      <h1 className="text-2xl font-bold">{subject.name}</h1>
      <ScoreForm sessionId={sessionId} subjectId={subjectId} criteria={criteriaView} gradeRatios={GRADE_RATIOS} />
    </div>
  )
}
