import { prisma } from '@/lib/db'
import { computeWeightedScore } from '@/lib/scoring'
import { criteriaScopeForSession, scoringUnitsForScope } from '@/lib/criteria-scope'
import { scoreUnitId, buildScoringUnits, type ScoringUnit } from '@/lib/criteria-units'
import { isAssignmentActive } from '@/lib/assignment'

// 채점 화면의 행 = 채점 단위(unit). 지표별 모드: 지표 1개, 통합(퉁) 모드: 세부항목 1개(indicators=지표 설명).
export interface CriterionView {
  id: string
  groupId: string
  groupName: string
  subitemName: string
  name: string
  // 통합 배점 세부항목이면 설명용 지표 목록(지표별 모드는 빈 배열)
  indicators: string[]
  maxScore: number
  weight: number
  value: number | null
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
  // 평가항목(그룹)별 의견 — groupId → 텍스트
  groupComments: Record<string, string>
  subjects: { id: string; name: string }[]
  otherScores: Record<string, { name: string; value: number }[]>
  otherPending: Record<string, string[]>
  submissionStatus: import('./submission').SubmissionStatus | null
}

// 점수 입력 화면(ScoreForm)에 필요한 전체 데이터 — 서버 페이지/ API 라우트 공용
export async function getSheetData(
  userId: string,
  userName: string,
  sessionId: string,
  subjectId: string,
): Promise<SheetData | null> {
  // 평가항목은 과제(Project) 단위 공통 — 분과의 소속 과제 항목을 읽는다.
  const criteriaWhere = await criteriaScopeForSession(sessionId)
  const [subject, session, units, existing, opinion, subjects, myScores, submission, assignment, myGroupComments] = await Promise.all([
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
    scoringUnitsForScope(criteriaWhere),
    prisma.score.findMany({ where: { evaluatorId: userId, subjectId } }),
    prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } } }),
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.score.findMany({
      where: { evaluatorId: userId, sessionId },
      select: { subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.submission.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } }, select: { status: true } }),
    prisma.assignment.findUnique({ where: { sessionId_userId: { sessionId, userId } }, select: { status: true } }),
    prisma.groupComment.findMany({ where: { evaluatorId: userId, subjectId }, select: { groupId: true, text: true } }),
  ])
  if (!subject || !session) return null
  if (!assignment || !isAssignmentActive(assignment.status)) return null

  const byUnit = new Map(existing.map((s) => [scoreUnitId(s), s]))
  const totalUnits = units.length
  const doneCountBySubject = new Map<string, number>()
  for (const s of myScores) doneCountBySubject.set(s.subjectId, (doneCountBySubject.get(s.subjectId) ?? 0) + 1)
  const doneSubjects = subjects.filter((s) => totalUnits > 0 && (doneCountBySubject.get(s.id) ?? 0) >= totalUnits).length

  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))
  const otherSubjects = subjects.filter((s) => s.id !== subjectId)
  const otherScores: Record<string, { name: string; value: number }[]> = {}
  const otherPending: Record<string, string[]> = {}
  for (const u of units) {
    const mine = myScores.filter((s) => scoreUnitId(s) === u.unitId && s.subjectId !== subjectId)
    const scoredIds = new Set(mine.map((s) => s.subjectId))
    otherScores[u.unitId] = mine
      .map((s) => ({ name: subjectName.get(s.subjectId) ?? '', value: s.value }))
      .sort((a, b) => b.value - a.value)
    otherPending[u.unitId] = otherSubjects.filter((s) => !scoredIds.has(s.id)).map((s) => s.name)
  }

  const criteriaView: CriterionView[] = units.map((u) => ({
    id: u.unitId,
    groupId: u.groupId,
    groupName: u.groupName,
    subitemName: u.subitemName,
    name: u.label,
    indicators: u.indicators,
    maxScore: u.maxScore,
    weight: u.weight,
    value: byUnit.get(u.unitId)?.value ?? null,
  }))

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
    groupComments: Object.fromEntries(myGroupComments.map((c) => [c.groupId, c.text])),
    subjects,
    otherScores,
    otherPending,
    submissionStatus: submission?.status ?? null,
  }
}

// ── 평가위원 홈(배정 심사 목록) ──
export interface AccordionCriterion {
  id: string
  groupName: string
  subitemName: string
  name: string
  indicators: string[]
  maxScore: number
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
      where: { userId, status: 'APPROVED', session: { status: 'IN_PROGRESS' } },
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
          },
        },
      },
    }),
    prisma.score.findMany({
      where: { evaluatorId: userId },
      select: { subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
  ])

  // 평가항목은 과제(Project) 단위 공통 — 배정 분과들의 소속 과제 항목을 한 번에 조회.
  // (과제 미소속 레거시 분과는 세션 단위 항목으로 폴백)
  const projectIds = [...new Set(assignments.map((a) => a.session.projectId).filter((v): v is string => !!v))]
  const legacySessionIds = assignments.filter((a) => !a.session.projectId).map((a) => a.session.id)
  const allGroups = await prisma.criterionGroup.findMany({
    where: {
      OR: [
        ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
        ...(legacySessionIds.length ? [{ sessionId: { in: legacySessionIds } }] : []),
      ],
    },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      projectId: true,
      sessionId: true,
      subitems: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          maxScore: true,
          criteria: { orderBy: { order: 'asc' }, select: { id: true, name: true, maxScore: true, weight: true } },
        },
      },
    },
  })
  const unitsOfSession = (s: { id: string; projectId: string | null }): ScoringUnit[] =>
    buildScoringUnits(
      s.projectId ? allGroups.filter((g) => g.projectId === s.projectId) : allGroups.filter((g) => g.sessionId === s.id),
    )

  const rowsBySubject = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of myScores) {
    if (!rowsBySubject.has(s.subjectId)) rowsBySubject.set(s.subjectId, [])
    rowsBySubject.get(s.subjectId)!.push({ criterionId: scoreUnitId(s), value: s.value })
  }

  return assignments.map((a) => {
    const units = unitsOfSession(a.session)
    const total = units.length
    const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }))
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
      criteria: units.map((u) => ({
        id: u.unitId,
        groupName: u.groupName,
        subitemName: u.subitemName,
        name: u.label,
        indicators: u.indicators,
        maxScore: u.maxScore,
      })),
      subjects,
    }
  })
}

// ── 위원장 총괄표 ──
export interface ChairCell {
  state: 'done' | 'partial' | 'none'
  score: number | null
  items: { name: string; maxScore: number; value: number | null }[]
  // 평가항목(그룹)별 의견 — 작성된 것만
  groupComments: { groupName: string; text: string }[]
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

  // 평가항목은 과제(Project) 단위 공통 — 채점 단위(unit) 기준으로 집계
  const criteriaWhere = await criteriaScopeForSession(sessionId)
  const [subjects, units, assignments, scores, opinions, groupComments] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    scoringUnitsForScope(criteriaWhere),
    prisma.assignment.findMany({ where: { sessionId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.score.findMany({
      where: { sessionId },
      select: { evaluatorId: true, subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.opinion.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, text: true } }),
    prisma.groupComment.findMany({
      where: { sessionId },
      select: { evaluatorId: true, subjectId: true, groupId: true, text: true },
    }),
  ])

  const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }))
  const totalUnits = units.length
  const orderedAssignments = [...assignments].sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))

  const byEvalSub = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of scores) {
    const k = `${s.evaluatorId}:${s.subjectId}`
    if (!byEvalSub.has(k)) byEvalSub.set(k, [])
    byEvalSub.get(k)!.push({ criterionId: scoreUnitId(s), value: s.value })
  }
  const scoreMap = new Map<string, number>()
  for (const s of scores) scoreMap.set(`${s.evaluatorId}:${s.subjectId}:${scoreUnitId(s)}`, s.value)
  const opinionMap = new Map<string, string>()
  for (const o of opinions) opinionMap.set(`${o.evaluatorId}:${o.subjectId}`, o.text)
  // (위원:대상:그룹) → 평가항목별 의견 / 그룹 순서는 units에서 유도
  const groupCommentMap = new Map<string, string>()
  for (const gc of groupComments) groupCommentMap.set(`${gc.evaluatorId}:${gc.subjectId}:${gc.groupId}`, gc.text)
  const orderedGroups: { id: string; name: string }[] = []
  for (const u of units) if (!orderedGroups.some((g) => g.id === u.groupId)) orderedGroups.push({ id: u.groupId, name: u.groupName })

  const cellOf = (evId: string, subId: string): ChairCell => {
    const rows = byEvalSub.get(`${evId}:${subId}`) ?? []
    const state: ChairCell['state'] = totalUnits > 0 && rows.length >= totalUnits ? 'done' : rows.length > 0 ? 'partial' : 'none'
    return {
      state,
      score: state === 'done' ? computeWeightedScore(rows, weights) : null,
      items: units.map((u) => ({ name: u.label, maxScore: u.maxScore, value: scoreMap.get(`${evId}:${subId}:${u.unitId}`) ?? null })),
      groupComments: orderedGroups.flatMap((g) => {
        const text = groupCommentMap.get(`${evId}:${subId}:${g.id}`)
        return text ? [{ groupName: g.name, text }] : []
      }),
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
