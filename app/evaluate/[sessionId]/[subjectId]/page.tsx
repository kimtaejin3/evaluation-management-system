import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { parseGradeOptions, defaultGradeOptions } from '@/lib/scoring'
import ScoreForm, { type CriterionView } from './ScoreForm'
import { SkeletonCard } from '@/components/Skeletons'

export default async function ScoreSheet({ params }: { params: Promise<{ sessionId: string; subjectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return null
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={5} />
        </div>
      }
    >
      <ScoreSheetContent params={params} userId={user.id} userName={user.name} />
    </Suspense>
  )
}

async function ScoreSheetContent({
  params,
  userId,
  userName,
}: {
  params: Promise<{ sessionId: string; subjectId: string }>
  userId: string
  userName: string
}) {
  const { sessionId, subjectId } = await params

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

  const existing = await prisma.score.findMany({ where: { evaluatorId: userId, subjectId } })
  const byCriterion = new Map(existing.map((s) => [s.criterionId, s]))
  const opinion = await prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } } })

  // 이 심사의 내 진행률(완료 대상 수 / 전체) + 대상 전환 드롭다운용
  const subjects = await prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } })
  const myScores = await prisma.score.findMany({ where: { evaluatorId: userId, sessionId }, select: { subjectId: true, criterionId: true, value: true } })
  const totalCriteria = criteria.length
  const doneCountBySubject = new Map<string, number>()
  for (const s of myScores) doneCountBySubject.set(s.subjectId, (doneCountBySubject.get(s.subjectId) ?? 0) + 1)
  const doneSubjects = subjects.filter((s) => totalCriteria > 0 && (doneCountBySubject.get(s.id) ?? 0) >= totalCriteria).length

  // 항목별 — 다른 대상에 내가 매긴 점수(평가한 모든 기업, 점수 높은 순)
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))
  const otherSubjects = subjects.filter((s) => s.id !== subjectId)
  const otherScores: Record<string, { name: string; value: number }[]> = {}
  const otherPending: Record<string, string[]> = {} // 항목별 — 아직 내가 평가하지 않은 다른 기업
  for (const c of criteria) {
    const scoredIds = new Set(
      myScores.filter((s) => s.criterionId === c.id && s.subjectId !== subjectId).map((s) => s.subjectId),
    )
    otherScores[c.id] = myScores
      .filter((s) => s.criterionId === c.id && s.subjectId !== subjectId)
      .map((s) => ({ name: subjectName.get(s.subjectId) ?? '', value: s.value }))
      .sort((a, b) => b.value - a.value)
    otherPending[c.id] = otherSubjects.filter((s) => !scoredIds.has(s.id)).map((s) => s.name)
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
      evaluatorName={userName}
      isChair={session.chairId === userId}
      eventDate={session.eventDate ? session.eventDate.toISOString() : null}
      progress={{ done: doneSubjects, total: subjects.length }}
      documents={subject.company.documents.map((d) => ({ id: d.id, name: d.originalName, mimeType: d.mimeType }))}
      criteria={criteriaView}
      initialComment={opinion?.text ?? ''}
      subjects={subjects}
      otherScores={otherScores}
      otherPending={otherPending}
    />
  )
}
