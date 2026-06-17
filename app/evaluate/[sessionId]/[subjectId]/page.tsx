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

  // 이 심사의 내 진행률(완료 대상 수 / 전체) + 대상 전환 드롭다운용
  const subjects = await prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } })
  const myScores = await prisma.score.findMany({ where: { evaluatorId: user.id, sessionId }, select: { subjectId: true, criterionId: true, value: true } })
  const totalCriteria = criteria.length
  const doneCountBySubject = new Map<string, number>()
  for (const s of myScores) doneCountBySubject.set(s.subjectId, (doneCountBySubject.get(s.subjectId) ?? 0) + 1)
  const doneSubjects = subjects.filter((s) => totalCriteria > 0 && (doneCountBySubject.get(s.id) ?? 0) >= totalCriteria).length

  // 항목별 — 다른 대상에 내가 매긴 점수(상위 5개, 점수 높은 순)
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))
  const otherScores: Record<string, { name: string; value: number }[]> = {}
  for (const c of criteria) {
    otherScores[c.id] = myScores
      .filter((s) => s.criterionId === c.id && s.subjectId !== subjectId)
      .map((s) => ({ name: subjectName.get(s.subjectId) ?? '', value: s.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }

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
      isChair={session.chairId === user.id}
      eventDate={session.eventDate ? session.eventDate.toISOString() : null}
      progress={{ done: doneSubjects, total: subjects.length }}
      documents={subject.company.documents.map((d) => ({ id: d.id, name: d.originalName, mimeType: d.mimeType }))}
      criteria={criteriaView}
      initialComment={opinion?.text ?? ''}
      subjects={subjects}
      otherScores={otherScores}
    />
  )
}
