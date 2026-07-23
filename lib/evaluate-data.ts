import { prisma } from '@/lib/db'
import { computeWeightedScore } from '@/lib/scoring'
import { criteriaScopeForSession, scoringUnitsForScope } from '@/lib/criteria-scope'
import { scoreUnitId, buildScoringUnits, type ScoringUnit } from '@/lib/criteria-units'
import { isAssignmentActive } from '@/lib/assignment'
import { chairEvalState, isSubmitted, neighborSubjects, type ChairEvalState } from '@/lib/chair-subject'

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

// ── 위원장 대상별 상세 ──
export interface ChairSubjectEvaluator {
  id: string
  name: string
  isChair: boolean
  /** 전 채점 단위 입력 완료 시 합계, 아니면 null */
  total: number | null
  state: ChairEvalState
  /** 평가항목(그룹)별 의견 — 작성된 것만 */
  groupComments: { groupName: string; text: string }[]
  submitted: boolean
}

export interface ChairSubjectData {
  sessionName: string
  subjectId: string
  subjectName: string
  evaluators: ChairSubjectEvaluator[]
  /** 위원장이 이 대상에 저장해 둔 통합의견(위원별 종합의견과 별개) */
  chairOpinion: string
  /** 분과 마감 또는 의견서 제출/승인 시 읽기 전용 */
  locked: boolean
  /** 읽기 전용 사유 — 'closed'(분과 마감) | 'opinionReviewed'(의견서 제출/승인) */
  lockReason: 'closed' | 'opinionReviewed' | null
  prevSubjectId: string | null
  nextSubjectId: string | null
}

// 위원장 본인만 접근 가능 — 아니면 null(라우트에서 403)
export async function getChairSubjectData(
  userId: string,
  sessionId: string,
  subjectId: string,
): Promise<ChairSubjectData | null> {
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.chairId !== userId) return null
  const chairId = session.chairId

  // 평가항목은 과제(Project) 단위 공통 — 채점 단위(unit) 기준으로 집계
  const criteriaWhere = await criteriaScopeForSession(sessionId)
  const [subjects, units, assignments, scores, groupComments, submissions] = await Promise.all([
    // chairOpinion(통합의견)은 대상 자체에 저장되므로 함께 읽는다
    prisma.subject.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, chairOpinion: true },
    }),
    scoringUnitsForScope(criteriaWhere),
    // 배정은 상태로 거르지 않는다(관리자 평가의견서 화면과 동일). 쓰는 필드만 select.
    prisma.assignment.findMany({ where: { sessionId }, select: { userId: true, user: { select: { name: true } } } }),
    prisma.score.findMany({
      where: { sessionId, subjectId },
      select: { evaluatorId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.groupComment.findMany({
      where: { sessionId, subjectId },
      select: { evaluatorId: true, groupId: true, text: true },
    }),
    prisma.submission.findMany({ where: { sessionId, subjectId }, select: { evaluatorId: true, status: true } }),
  ])

  const subject = subjects.find((s) => s.id === subjectId)
  if (!subject) return null

  const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }))
  const totalUnits = units.length

  const rowsOf = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of scores) {
    if (!rowsOf.has(s.evaluatorId)) rowsOf.set(s.evaluatorId, [])
    rowsOf.get(s.evaluatorId)!.push({ criterionId: scoreUnitId(s), value: s.value })
  }
  const commentOf = new Map<string, string>()
  for (const gc of groupComments) commentOf.set(`${gc.evaluatorId}:${gc.groupId}`, gc.text)
  const statusOf = new Map<string, string>()
  for (const sub of submissions) statusOf.set(sub.evaluatorId, sub.status)

  // 평가항목(그룹) 표시 순서는 채점 단위 순서에서 유도
  const orderedGroups: { id: string; name: string }[] = []
  for (const u of units) if (!orderedGroups.some((g) => g.id === u.groupId)) orderedGroups.push({ id: u.groupId, name: u.groupName })

  // 위원장을 맨 앞에
  const ordered = [...assignments].sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))

  // 마감된 분과, 그리고 의견서가 간사 검토 제출/관리자 승인된 뒤에는 읽기 전용
  // (서버의 saveChairOpinion 가드와 동일한 규칙)
  const opinionReviewed = session.opinionStatus === 'SUBMITTED' || session.opinionStatus === 'APPROVED'
  const lockReason: 'closed' | 'opinionReviewed' | null =
    session.status === 'CLOSED' ? 'closed' : opinionReviewed ? 'opinionReviewed' : null

  return {
    sessionName: session.name,
    subjectId,
    subjectName: subject.name,
    locked: lockReason !== null,
    lockReason,
    chairOpinion: subject.chairOpinion ?? '',
    ...neighborSubjects(subjects.map((s) => s.id), subjectId),
    evaluators: ordered.map((a) => {
      const rows = rowsOf.get(a.userId) ?? []
      const state = chairEvalState(rows.length, totalUnits)
      return {
        id: a.userId,
        name: a.user.name,
        isChair: a.userId === chairId,
        state,
        total: state === 'complete' ? computeWeightedScore(rows, weights) : null,
        groupComments: orderedGroups.flatMap((g) => {
          const text = commentOf.get(`${a.userId}:${g.id}`)
          return text ? [{ groupName: g.name, text }] : []
        }),
        submitted: isSubmitted(statusOf.get(a.userId)),
      }
    }),
  }
}
