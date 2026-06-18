import { prisma } from '@/lib/db'
import { parseGradeOptions, defaultGradeOptions, computeWeightedScore, type GradeOption } from '@/lib/scoring'

export interface CriterionView {
  id: string
  section: string | null
  name: string
  description: string | null
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  maxScore: number
  weight: number
  value: number | null
  options: GradeOption[] | null
  selectedIndex: number | null
}

export interface SheetData {
  subjectName: string
  sessionName: string
  evaluatorName: string
  isChair: boolean
  eventDate: string | null
  progress: { done: number; total: number }
  documents: { id: string; name: string; mimeType: string }[]
  criteria: CriterionView[]
  initialComment: string
  subjects: { id: string; name: string }[]
  otherScores: Record<string, { name: string; value: number }[]>
  otherPending: Record<string, string[]>
}

// 점수 입력 화면(ScoreForm)에 필요한 전체 데이터 — 서버 페이지/ API 라우트 공용
export async function getSheetData(
  userId: string,
  userName: string,
  sessionId: string,
  subjectId: string,
): Promise<SheetData | null> {
  const [subject, session, criteria, existing, opinion, subjects, myScores] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        company: {
          include: {
            documents: { where: { OR: [{ sessionId }, { sessionId: null }] }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    }),
    prisma.evaluationSession.findUnique({ where: { id: sessionId } }),
    prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } }),
    prisma.score.findMany({ where: { evaluatorId: userId, subjectId } }),
    prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } } }),
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.score.findMany({ where: { evaluatorId: userId, sessionId }, select: { subjectId: true, criterionId: true, value: true } }),
  ])
  if (!subject || !session) return null

  const byCriterion = new Map(existing.map((s) => [s.criterionId, s]))
  const totalCriteria = criteria.length
  const doneCountBySubject = new Map<string, number>()
  for (const s of myScores) doneCountBySubject.set(s.subjectId, (doneCountBySubject.get(s.subjectId) ?? 0) + 1)
  const doneSubjects = subjects.filter((s) => totalCriteria > 0 && (doneCountBySubject.get(s.id) ?? 0) >= totalCriteria).length

  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))
  const otherSubjects = subjects.filter((s) => s.id !== subjectId)
  const otherScores: Record<string, { name: string; value: number }[]> = {}
  const otherPending: Record<string, string[]> = {}
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

  return {
    subjectName: subject.name,
    sessionName: session.name,
    evaluatorName: userName,
    isChair: session.chairId === userId,
    eventDate: session.eventDate ? session.eventDate.toISOString() : null,
    progress: { done: doneSubjects, total: subjects.length },
    documents: subject.company.documents.map((d) => ({ id: d.id, name: d.originalName, mimeType: d.mimeType })),
    criteria: criteriaView,
    initialComment: opinion?.text ?? '',
    subjects,
    otherScores,
    otherPending,
  }
}

// ── 평가위원 홈(배정 심사 목록) ──
export interface AccordionCriterion {
  id: string
  section: string | null
  name: string
  description: string | null
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  maxScore: number
  gradeOptions: unknown
}
export interface HomeSubject {
  id: string
  name: string
  description: string | null
  status: 'complete' | 'inProgress' | 'none'
  score: number | null
  docs: { id: string; name: string }[]
}
export interface HomeSession {
  assignmentId: string
  sessionId: string
  sessionName: string
  isChair: boolean
  eventDate: string | null
  doneSubjects: number
  totalSubjects: number
  criteria: AccordionCriterion[]
  subjects: HomeSubject[]
}

export async function getHomeData(userId: string): Promise<HomeSession[]> {
  const [assignments, myScores] = await Promise.all([
    prisma.assignment.findMany({
      where: { userId, session: { status: 'IN_PROGRESS' } },
      include: {
        session: {
          include: {
            subjects: {
              orderBy: { order: 'asc' },
              include: {
                company: {
                  include: {
                    documents: { orderBy: { createdAt: 'asc' }, select: { id: true, originalName: true, sessionId: true } },
                  },
                },
              },
            },
            criteria: true,
          },
        },
      },
    }),
    prisma.score.findMany({ where: { evaluatorId: userId }, select: { subjectId: true, criterionId: true, value: true } }),
  ])

  const rowsBySubject = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of myScores) {
    if (!rowsBySubject.has(s.subjectId)) rowsBySubject.set(s.subjectId, [])
    rowsBySubject.get(s.subjectId)!.push({ criterionId: s.criterionId, value: s.value })
  }

  return assignments.map((a) => {
    const total = a.session.criteria.length
    const weights = a.session.criteria.map((c) => ({ id: c.id, weight: c.weight }))
    const subjects: HomeSubject[] = a.session.subjects.map((sub) => {
      const rows = rowsBySubject.get(sub.id) ?? []
      const complete = total > 0 && rows.length >= total
      const inProgress = rows.length > 0 && !complete
      return {
        id: sub.id,
        name: sub.name,
        description: sub.company.description ?? null,
        status: complete ? 'complete' : inProgress ? 'inProgress' : 'none',
        score: complete ? computeWeightedScore(rows, weights) : null,
        docs: sub.company.documents
          .filter((d) => d.sessionId === a.session.id || d.sessionId === null)
          .map((d) => ({ id: d.id, name: d.originalName })),
      }
    })
    return {
      assignmentId: a.id,
      sessionId: a.session.id,
      sessionName: a.session.name,
      isChair: a.session.chairId === userId,
      eventDate: a.session.eventDate ? a.session.eventDate.toISOString() : null,
      doneSubjects: subjects.filter((s) => s.status === 'complete').length,
      totalSubjects: subjects.length,
      criteria: a.session.criteria
        .slice()
        .sort((x, y) => x.order - y.order)
        .map((c) => ({ id: c.id, section: c.section, name: c.name, description: c.description, type: c.type, maxScore: c.maxScore, gradeOptions: c.gradeOptions })),
      subjects,
    }
  })
}

// ── 위원장 총괄표 ──
export interface ChairCell {
  state: 'done' | 'partial' | 'none'
  score: number | null
  items: { name: string; maxScore: number; value: number | null }[]
  opinion: string | null
}
export interface ChairRow {
  subjectId: string
  subjectName: string
  avg: number | null
  rank: number | null
  cells: ChairCell[] // evaluators 순서와 정렬
}
export interface ChairData {
  sessionName: string
  chairSummary: string
  evaluators: { id: string; name: string; isChair: boolean }[]
  rows: ChairRow[]
}

// 위원장 본인만 접근 가능 — 아니면 null
export async function getChairData(userId: string, sessionId: string): Promise<ChairData | null> {
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.chairId !== userId) return null
  const chairId = session.chairId

  const [subjects, criteria, assignments, scores, opinions] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true, maxScore: true, weight: true } }),
    prisma.assignment.findMany({ where: { sessionId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true, value: true } }),
    prisma.opinion.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, text: true } }),
  ])

  const weights = criteria.map((c) => ({ id: c.id, weight: c.weight }))
  const totalCri = criteria.length
  const orderedAssignments = [...assignments].sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))

  const byEvalSub = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of scores) {
    const k = `${s.evaluatorId}:${s.subjectId}`
    if (!byEvalSub.has(k)) byEvalSub.set(k, [])
    byEvalSub.get(k)!.push({ criterionId: s.criterionId, value: s.value })
  }
  const scoreMap = new Map<string, number>()
  for (const s of scores) scoreMap.set(`${s.evaluatorId}:${s.subjectId}:${s.criterionId}`, s.value)
  const opinionMap = new Map<string, string>()
  for (const o of opinions) opinionMap.set(`${o.evaluatorId}:${o.subjectId}`, o.text)

  const cellOf = (evId: string, subId: string): ChairCell => {
    const rows = byEvalSub.get(`${evId}:${subId}`) ?? []
    const state: ChairCell['state'] = totalCri > 0 && rows.length >= totalCri ? 'done' : rows.length > 0 ? 'partial' : 'none'
    return {
      state,
      score: state === 'done' ? computeWeightedScore(rows, weights) : null,
      items: criteria.map((c) => ({ name: c.name, maxScore: c.maxScore, value: scoreMap.get(`${evId}:${subId}:${c.id}`) ?? null })),
      opinion: opinionMap.get(`${evId}:${subId}`) ?? null,
    }
  }

  // 평균 + 순위(완료 위원 기준)
  const avgById = new Map<string, number | null>()
  for (const sub of subjects) {
    const totals: number[] = []
    for (const a of assignments) {
      const c = cellOf(a.userId, sub.id)
      if (c.state === 'done' && c.score != null) totals.push(c.score)
    }
    avgById.set(sub.id, totals.length ? totals.reduce((x, y) => x + y, 0) / totals.length : null)
  }
  const sortedAvg = [...subjects].filter((s) => avgById.get(s.id) != null).sort((a, b) => (avgById.get(b.id) ?? 0) - (avgById.get(a.id) ?? 0))
  const rankMap = new Map<string, number>()
  sortedAvg.forEach((s, i) => {
    const prev = sortedAvg[i - 1]
    const rank = i > 0 && avgById.get(prev.id) === avgById.get(s.id) ? rankMap.get(prev.id)! : i + 1
    rankMap.set(s.id, rank)
  })

  return {
    sessionName: session.name,
    chairSummary: session.chairSummary ?? '',
    evaluators: orderedAssignments.map((a) => ({ id: a.userId, name: a.user.name, isChair: a.userId === chairId })),
    rows: subjects.map((sub) => ({
      subjectId: sub.id,
      subjectName: sub.name,
      avg: avgById.get(sub.id) ?? null,
      rank: rankMap.get(sub.id) ?? null,
      cells: orderedAssignments.map((a) => cellOf(a.userId, sub.id)),
    })),
  }
}
