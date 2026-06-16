import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { parseGradeOptions, defaultGradeOptions } from '@/lib/scoring'
import ScoreForm, { type CriterionView } from './ScoreForm'

export default async function ScoreSheet({ params }: { params: Promise<{ sessionId: string; subjectId: string }> }) {
  const { sessionId, subjectId } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      company: {
        include: {
          documents: { where: { OR: [{ sessionId }, { sessionId: null }] }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
  if (!subject || !session) notFound()

  const existing = await prisma.score.findMany({ where: { evaluatorId: user.id, subjectId } })
  const byCriterion = new Map(existing.map((s) => [s.criterionId, s]))
  const opinion = await prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } } })

  // 이 심사의 내 진행률(완료 대상 수 / 전체)
  const subjects = await prisma.subject.findMany({ where: { sessionId }, select: { id: true } })
  const myScores = await prisma.score.findMany({ where: { evaluatorId: user.id, sessionId }, select: { subjectId: true, criterionId: true } })
  const totalCriteria = criteria.length
  const doneCountBySubject = new Map<string, number>()
  for (const s of myScores) doneCountBySubject.set(s.subjectId, (doneCountBySubject.get(s.subjectId) ?? 0) + 1)
  const doneSubjects = subjects.filter((s) => totalCriteria > 0 && (doneCountBySubject.get(s.id) ?? 0) >= totalCriteria).length

  const criteriaView: CriterionView[] = criteria.map((c) => {
    const cur = byCriterion.get(c.id)
    const options = c.type === 'QUALITATIVE' ? (parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)) : null
    let selectedIndex: number | null = null
    if (options && cur) {
      const byLabel = options.findIndex((o) => o.label === cur.grade)
      selectedIndex = byLabel >= 0 ? byLabel : options.findIndex((o) => o.points === cur.value)
      if (selectedIndex < 0) selectedIndex = null
    }
    return {
      id: c.id,
      section: c.section,
      name: c.name,
      description: c.description,
      type: c.type,
      maxScore: c.maxScore,
      weight: c.weight,
      value: cur ? cur.value : null,
      options,
      selectedIndex,
    }
  })

  return (
    <ScoreForm
      sessionId={sessionId}
      subjectId={subjectId}
      subjectName={subject.name}
      sessionName={session.name}
      evaluatorName={user.name}
      eventDate={session.eventDate ? session.eventDate.toISOString() : null}
      progress={{ done: doneSubjects, total: subjects.length }}
      documents={subject.company.documents.map((d) => ({ id: d.id, name: d.originalName, mimeType: d.mimeType }))}
      criteria={criteriaView}
      initialComment={opinion?.text ?? ''}
    />
  )
}
