import { prisma } from './db'
import { computeWeightedScore } from './scoring'
import { cellStatus, type CellStatus, type SubmissionStatus } from './submission'

export type CellState = 'done' | 'partial' | 'none'

// 간사 제출 검토 표의 한 행 (대상 × 위원)
export interface ReviewRow {
  subjectId: string
  subjectName: string
  evaluatorId: string
  evaluatorName: string
  status: CellStatus
  total: number | null
}

export interface CellItem {
  id: string
  name: string
  done: boolean
  editingAt?: number | null // 위원이 현재 입력 중이면 그 시각(ms), 아니면 null
}

export interface Cell {
  subjectId: string
  state: CellState
  status: CellStatus // 제출/승인 상태까지 반영한 표시 상태
  items: CellItem[]
  done: number // 입력된 항목 수
  total: number // 전체 항목 수
}

export interface ProgressData {
  subjects: { id: string; name: string }[]
  criteria: { id: string; name: string }[]
  totalCriteria: number
  rows: {
    userId: string
    name: string
    isChair: boolean
    username: string
    phone: string | null
    cells: Cell[]
    doneItems: number
    totalItems: number
  }[]
  subjectSummary: { id: string; name: string; done: number; total: number }[]
  review: ReviewRow[]
  assignedCount: number
  completedEvaluators: number
  pct: number
  doneCells: number
  totalCells: number
}

export async function getSessionProgress(sessionId: string): Promise<ProgressData> {
  const [session, subjects, criteria, assignments, scores, editing, submissions] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { chairId: true } }),
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true, weight: true } }),
    prisma.assignment.findMany({ where: { sessionId, status: 'APPROVED' }, include: { user: true } }),
    prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true, value: true } }),
    prisma.editingPresence.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true, updatedAt: true } }),
    prisma.submission.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, status: true } }),
  ])
  const chairId = session?.chairId ?? null
  const subOf = new Map<string, SubmissionStatus>()
  for (const s of submissions) subOf.set(`${s.evaluatorId}:${s.subjectId}`, s.status)
  const weights = criteria.map((c) => ({ id: c.id, weight: c.weight }))
  const scoreRowsOf = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of scores) {
    const k = `${s.evaluatorId}:${s.subjectId}`
    if (!scoreRowsOf.has(k)) scoreRowsOf.set(k, [])
    scoreRowsOf.get(k)!.push({ criterionId: s.criterionId, value: s.value })
  }

  const totalCriteria = criteria.length
  // 입력된 (위원:대상:항목) 집합
  const filled = new Set<string>()
  for (const s of scores) filled.add(`${s.evaluatorId}:${s.subjectId}:${s.criterionId}`)
  // 현재 입력 중 (위원:대상:항목) → 시각(ms)
  const editingAtOf = new Map<string, number>()
  for (const e of editing) editingAtOf.set(`${e.evaluatorId}:${e.subjectId}:${e.criterionId}`, e.updatedAt.getTime())

  const cellOf = (evId: string, subId: string): Cell => {
    const items: CellItem[] = criteria.map((c) => {
      const done = filled.has(`${evId}:${subId}:${c.id}`)
      return {
        id: c.id,
        name: c.name,
        done,
        editingAt: done ? null : (editingAtOf.get(`${evId}:${subId}:${c.id}`) ?? null),
      }
    })
    const done = items.filter((it) => it.done).length
    const state: CellState = totalCriteria > 0 && done >= totalCriteria ? 'done' : done > 0 ? 'partial' : 'none'
    const status = cellStatus(subOf.get(`${evId}:${subId}`) ?? null, done, totalCriteria)
    return { subjectId: subId, state, status, items, done, total: totalCriteria }
  }

  // 위원장을 맨 앞으로
  const orderedAssignments = [...assignments].sort(
    (a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0),
  )
  const rows = orderedAssignments.map((a) => {
    const cells = subjects.map((s) => cellOf(a.userId, s.id))
    const doneItems = cells.reduce((sum, c) => sum + c.done, 0)
    return {
      userId: a.userId,
      name: a.user.name,
      isChair: a.userId === chairId,
      username: a.user.username,
      phone: a.user.phone,
      cells,
      doneItems,
      totalItems: subjects.length * totalCriteria,
    }
  })

  const subjectSummary = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    done: assignments.filter((a) => cellOf(a.userId, s.id).state === 'done').length,
    total: assignments.length,
  }))

  // 간사 제출 검토 표 데이터 (대상 × 위원). 총점은 전 항목 입력 시에만 산출.
  const review: ReviewRow[] = []
  for (const s of subjects) {
    for (const a of orderedAssignments) {
      const key = `${a.userId}:${s.id}`
      const rows0 = scoreRowsOf.get(key) ?? []
      const status = cellStatus(subOf.get(key) ?? null, rows0.length, totalCriteria)
      const total = totalCriteria > 0 && rows0.length >= totalCriteria ? computeWeightedScore(rows0, weights) : null
      review.push({ subjectId: s.id, subjectName: s.name, evaluatorId: a.userId, evaluatorName: a.user.name, status, total })
    }
  }

  const totalCells = assignments.length * subjects.length
  let doneCells = 0
  for (const r of rows) doneCells += r.cells.filter((c) => c.state === 'done').length
  const completedEvaluators = rows.filter((r) => subjects.length > 0 && r.cells.every((c) => c.state === 'done')).length

  return {
    subjects,
    criteria,
    totalCriteria,
    rows,
    review,
    subjectSummary,
    assignedCount: assignments.length,
    completedEvaluators,
    pct: totalCells > 0 ? Math.round((doneCells / totalCells) * 100) : 0,
    doneCells,
    totalCells,
  }
}

// 진행 상태 변경 감지용 경량 버전 해시(전체 progress 계산 없이 빠르게 폴링).
// 점수 개수·최신 수정시각(추가/수정), 배정·대상·항목 개수(구조 변경/삭제)를 조합.
export async function getProgressVersion(sessionId: string): Promise<string> {
  const [scoreAgg, assignCount, subjCount, critCount, editAgg] = await Promise.all([
    prisma.score.aggregate({ where: { sessionId }, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.assignment.count({ where: { sessionId, status: 'APPROVED' } }),
    prisma.subject.count({ where: { sessionId } }),
    prisma.criterion.count({ where: { sessionId } }),
    // 입력 중(포커스) 변화도 감지해 대시보드 애니메이션이 실시간 반영되게 함
    prisma.editingPresence.aggregate({ where: { sessionId }, _count: { _all: true }, _max: { updatedAt: true } }),
  ])
  const ts = scoreAgg._max.updatedAt ? scoreAgg._max.updatedAt.getTime() : 0
  const ets = editAgg._max.updatedAt ? editAgg._max.updatedAt.getTime() : 0
  return `${scoreAgg._count._all}:${ts}:${assignCount}:${subjCount}:${critCount}:${editAgg._count._all}:${ets}`
}

// ---- 대시보드 인사이트(잠정 순위 + 위원 간 편차) ----

export interface InsightRow {
  subjectId: string
  name: string
  completeCount: number // 모든 항목을 입력한 위원 수
  avg: number | null // 완료 위원 가중점수 평균(잠정)
  rank: number | null // avg 기준 순위(동점 동순위)
  spread: number | null // 완료 위원 2명 이상일 때 max-min
}

export interface SessionInsights {
  rows: InsightRow[] // avg 내림차순, 집계 전(null)은 뒤로
  hasAnyScore: boolean
}

export async function getSessionInsights(sessionId: string): Promise<SessionInsights> {
  const [subjects, criteria, assignments, allScores, approvedSubs] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.criterion.findMany({ where: { sessionId }, select: { id: true, weight: true } }),
    prisma.assignment.findMany({ where: { sessionId, status: 'APPROVED' }, select: { userId: true } }),
    prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true, value: true } }),
    prisma.submission.findMany({ where: { sessionId, status: 'APPROVED' }, select: { evaluatorId: true, subjectId: true } }),
  ])

  // 잠정 순위·편차도 승인분만 반영
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`))
  const scores = allScores.filter((s) => approved.has(`${s.evaluatorId}:${s.subjectId}`))

  const totalCriteria = criteria.length
  const evaluatorIds = assignments.map((a) => a.userId)

  // subject -> evaluator -> rows
  const grouped = new Map<string, Map<string, { criterionId: string; value: number }[]>>()
  for (const s of scores) {
    if (!grouped.has(s.subjectId)) grouped.set(s.subjectId, new Map())
    const byEval = grouped.get(s.subjectId)!
    if (!byEval.has(s.evaluatorId)) byEval.set(s.evaluatorId, [])
    byEval.get(s.evaluatorId)!.push({ criterionId: s.criterionId, value: s.value })
  }

  const base = subjects.map((sub) => {
    const byEval = grouped.get(sub.id)
    // 모든 항목을 입력한 위원만 잠정 집계에 포함
    const totals: number[] = []
    if (byEval && totalCriteria > 0) {
      for (const evId of evaluatorIds) {
        const rows = byEval.get(evId)
        if (rows && rows.length >= totalCriteria) {
          totals.push(computeWeightedScore(rows, criteria))
        }
      }
    }
    const completeCount = totals.length
    const avg = completeCount > 0 ? totals.reduce((a, b) => a + b, 0) / completeCount : null
    const spread = completeCount >= 2 ? Math.max(...totals) - Math.min(...totals) : null
    return { subjectId: sub.id, name: sub.name, completeCount, avg, spread }
  })

  // 순위(avg 있는 것만, 동점 동순위)
  const scored = base.filter((r) => r.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
  const rankMap = new Map<string, number>()
  scored.forEach((r, i) => {
    const rank = i > 0 && scored[i - 1].avg === r.avg ? rankMap.get(scored[i - 1].subjectId)! : i + 1
    rankMap.set(r.subjectId, rank)
  })

  const rows: InsightRow[] = base
    .map((r) => ({ ...r, rank: rankMap.get(r.subjectId) ?? null }))
    .sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0
      if (a.avg === null) return 1
      if (b.avg === null) return -1
      return b.avg - a.avg
    })

  return { rows, hasAnyScore: scores.length > 0 }
}
