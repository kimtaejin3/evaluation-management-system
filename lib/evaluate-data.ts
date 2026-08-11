import { prisma } from '@/lib/db'
import { computeWeightedScore } from '@/lib/scoring'
import { criteriaScopeForSession, scoringUnitsForScope } from '@/lib/criteria-scope'
import { scoreUnitId, buildScoringUnits, type ScoringUnit } from '@/lib/criteria-units'
import { isAssignmentActive } from '@/lib/assignment'
import { chairEvalState, isSubmitted, neighborSubjects, type ChairEvalState } from '@/lib/chair-subject'
import { reviewFlags } from '@/lib/submission'

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
  // 소속 과제명(분과명 앞에 표기). 과제 미소속 레거시 분과는 null.
  projectName: string | null
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
  // 담당자 검토 완료(opinionStatus SUBMITTED/APPROVED) · 관리자 승인(APPROVED)
  secretaryReviewed: boolean
  masterApproved: boolean
  // 상단 진행 스텝 완료 플래그(5): 평가의견 작성·제출·위원장 검토·담당자 검토·관리자 검토(최종)
  reviewFlags: boolean[]
}

// 점수 입력 화면(ScoreForm)에 필요한 전체 데이터 — 서버 페이지/ API 라우트 공용
export async function getSheetData(
  userId: string,
  userName: string,
  sessionId: string,
  subjectId: string,
): Promise<SheetData | null> {
  // 평가항목은 사업(Project) 단위 공통 — 분과의 소속 사업 항목을 읽는다.
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
    prisma.evaluationSession.findUnique({ where: { id: sessionId }, include: { project: { select: { name: true } } } }),
    scoringUnitsForScope(criteriaWhere),
    prisma.score.findMany({ where: { evaluatorId: userId, subjectId } }),
    prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } } }),
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.score.findMany({
      where: { evaluatorId: userId, sessionId },
      select: { subjectId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.submission.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } }, select: { status: true, chairConfirmedAt: true } }),
    prisma.assignment.findUnique({ where: { sessionId_userId: { sessionId, userId } }, select: { status: true } }),
    prisma.groupComment.findMany({ where: { evaluatorId: userId, subjectId }, select: { groupId: true, text: true } }),
  ])
  if (!subject || !session) return null
  // 사업이 삭제된 고아 분과(projectId=null)는 평가 대상이 아니다 — 접근 차단.
  if (!session.projectId) return null
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
    projectName: session.project?.name ?? null,
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
    // 담당자 검토/관리자 검토 스텝은 분과 단위 '평가 의견서' 검토 상태로 판정
    secretaryReviewed: session.opinionStatus === 'SUBMITTED' || session.opinionStatus === 'APPROVED',
    masterApproved: session.opinionStatus === 'APPROVED',
    reviewFlags: reviewFlags({
      status: submission?.status ?? null,
      scored: totalUnits > 0 && byUnit.size >= totalUnits,
      chairConfirmed: submission?.chairConfirmedAt != null,
      secretaryReviewed: session.opinionStatus === 'SUBMITTED' || session.opinionStatus === 'APPROVED',
      masterApproved: session.opinionStatus === 'APPROVED',
    }),
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
  // 소속 과제명(분과명 앞에 표기). 과제 미소속 레거시 분과는 null.
  projectName: string | null
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
      // projectId:null(사업이 삭제되어 고아가 된 분과)는 평가위원에게 노출하지 않는다.
      // 사업 삭제는 이제 분과까지 정리하지만(deleteProject), 과거 고아가 남아도 새어나가지 않도록 방어.
      where: { userId, status: 'APPROVED', session: { status: 'IN_PROGRESS', projectId: { not: null } } },
      include: {
        session: {
          include: {
            project: { select: { name: true } },
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

  // 평가항목은 사업(Project) 단위 공통 — 배정 분과들의 소속 사업 항목을 한 번에 조회.
  // (사업 미소속 레거시 분과는 세션 단위 항목으로 폴백)
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
      projectName: a.session.project?.name ?? null,
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
  /** 이 위원이 쓴 종합의견 */
  opinion: string | null
  submitted: boolean
  /** 위원장이 이 위원의 평가를 확인했는지 — 담당자·마스터 승인과는 별개 */
  chairConfirmed: boolean
}

export interface ChairSubjectData {
  sessionName: string
  // 소속 과제명(분과명 앞에 표기). 과제 미소속 레거시 분과는 null.
  projectName: string | null
  // 위원장 본인의 이 대상 제출 상태(상단 진행 스텝 계산용)
  chairSubmissionStatus: import('./submission').SubmissionStatus | null
  subjectId: string
  subjectName: string
  evaluators: ChairSubjectEvaluator[]
  /** 위원장이 이 대상에 쓴 종합의견 — 화면에는 '위원장 종합의견'으로 표시한다 */
  chairOpinion: string
  /** 분과 마감 또는 의견서 제출/승인 시 읽기 전용 */
  locked: boolean
  /** 읽기 전용 사유 — 'closed'(분과 마감) | 'opinionReviewed'(의견서 제출/승인) */
  lockReason: 'closed' | 'opinionReviewed' | null
  /** 담당자 검토 완료(opinionStatus SUBMITTED/APPROVED) · 관리자 승인(APPROVED) — 진행 스텝용 */
  secretaryReviewed: boolean
  masterApproved: boolean
  prevSubjectId: string | null
  nextSubjectId: string | null
}

// 위원장 본인만 접근 가능 — 아니면 null(라우트에서 403)
export async function getChairSubjectData(
  userId: string,
  sessionId: string,
  subjectId: string,
): Promise<ChairSubjectData | null> {
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, include: { project: { select: { name: true } } } })
  if (!session || session.chairId !== userId) return null
  // 사업이 삭제된 고아 분과(projectId=null)는 위원장 화면에도 노출하지 않는다.
  if (!session.projectId) return null
  const chairId = session.chairId

  // 평가항목은 사업(Project) 단위 공통 — 채점 단위(unit) 기준으로 집계
  const criteriaWhere = await criteriaScopeForSession(sessionId)
  const [subjects, units, assignments, scores, groupComments, submissions, chairOpinionRow, opinions] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
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
    prisma.submission.findMany({
      where: { sessionId, subjectId },
      select: { evaluatorId: true, status: true, chairConfirmedAt: true },
    }),
    // 위원장의 종합의견 — 위원장은 평가표 대신 이 화면에서 작성한다
    prisma.opinion.findUnique({
      where: { evaluatorId_subjectId: { evaluatorId: chairId, subjectId } },
      select: { text: true },
    }),
    // 이 대상에 대한 위원별 종합의견
    prisma.opinion.findMany({ where: { sessionId, subjectId }, select: { evaluatorId: true, text: true } }),
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
  const chairConfirmedOf = new Map<string, boolean>()
  for (const sub of submissions) {
    statusOf.set(sub.evaluatorId, sub.status)
    chairConfirmedOf.set(sub.evaluatorId, sub.chairConfirmedAt != null)
  }
  const opinionOf = new Map<string, string>()
  for (const o of opinions) if (o.text.trim()) opinionOf.set(o.evaluatorId, o.text)

  // 평가항목(그룹) 표시 순서는 채점 단위 순서에서 유도
  const orderedGroups: { id: string; name: string }[] = []
  for (const u of units) if (!orderedGroups.some((g) => g.id === u.groupId)) orderedGroups.push({ id: u.groupId, name: u.groupName })

  // 위원장을 맨 앞에
  const ordered = [...assignments].sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))

  // 마감된 분과, 그리고 의견서가 담당자 검토 제출/관리자 승인된 뒤에는 읽기 전용
  // (서버의 saveChairOpinion 가드와 동일한 규칙)
  const opinionReviewed = session.opinionStatus === 'SUBMITTED' || session.opinionStatus === 'APPROVED'
  const lockReason: 'closed' | 'opinionReviewed' | null =
    session.status === 'CLOSED' ? 'closed' : opinionReviewed ? 'opinionReviewed' : null

  return {
    sessionName: session.name,
    projectName: session.project?.name ?? null,
    chairSubmissionStatus: (statusOf.get(chairId) ?? null) as import('./submission').SubmissionStatus | null,
    subjectId,
    subjectName: subject.name,
    locked: lockReason !== null,
    lockReason,
    secretaryReviewed: opinionReviewed,
    masterApproved: session.opinionStatus === 'APPROVED',
    chairOpinion: chairOpinionRow?.text ?? '',
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
        opinion: opinionOf.get(a.userId) ?? null,
        submitted: isSubmitted(statusOf.get(a.userId)),
        chairConfirmed: chairConfirmedOf.get(a.userId) ?? false,
      }
    }),
  }
}
