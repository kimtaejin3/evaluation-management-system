import { prisma } from './db'
import { computeWeightedScore } from './scoring'

export type CellState = 'done' | 'partial' | 'none'

export interface CellItem {
  id: string
  name: string
  done: boolean
}

export interface Cell {
  subjectId: string
  state: CellState
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
    cells: Cell[]
    doneItems: number
    totalItems: number
  }[]
  subjectSummary: { id: string; name: string; done: number; total: number }[]
  assignedCount: number
  completedEvaluators: number
  pct: number
  doneCells: number
  totalCells: number
}

export async function getSessionProgress(sessionId: string): Promise<ProgressData> {
  const [subjects, criteria, assignments, scores] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.assignment.findMany({ where: { sessionId }, include: { user: true } }),
    prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true } }),
  ])

  const totalCriteria = criteria.length
  // 입력된 (위원:대상:항목) 집합
  const filled = new Set<string>()
  for (const s of scores) filled.add(`${s.evaluatorId}:${s.subjectId}:${s.criterionId}`)

  const cellOf = (evId: string, subId: string): Cell => {
    const items: CellItem[] = criteria.map((c) => ({
      id: c.id,
      name: c.name,
      done: filled.has(`${evId}:${subId}:${c.id}`),
    }))
    const done = items.filter((it) => it.done).length
    const state: CellState = totalCriteria > 0 && done >= totalCriteria ? 'done' : done > 0 ? 'partial' : 'none'
    return { subjectId: subId, state, items, done, total: totalCriteria }
  }

  const rows = assignments.map((a) => {
    const cells = subjects.map((s) => cellOf(a.userId, s.id))
    const doneItems = cells.reduce((sum, c) => sum + c.done, 0)
    return {
      userId: a.userId,
      name: a.user.name,
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

  const totalCells = assignments.length * subjects.length
  let doneCells = 0
  for (const r of rows) doneCells += r.cells.filter((c) => c.state === 'done').length
  const completedEvaluators = rows.filter((r) => subjects.length > 0 && r.cells.every((c) => c.state === 'done')).length

  return {
    subjects,
    criteria,
    totalCriteria,
    rows,
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
  const [scoreAgg, assignCount, subjCount, critCount] = await Promise.all([
    prisma.score.aggregate({ where: { sessionId }, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.assignment.count({ where: { sessionId } }),
    prisma.subject.count({ where: { sessionId } }),
    prisma.criterion.count({ where: { sessionId } }),
  ])
  const ts = scoreAgg._max.updatedAt ? scoreAgg._max.updatedAt.getTime() : 0
  return `${scoreAgg._count._all}:${ts}:${assignCount}:${subjCount}:${critCount}`
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
  const [subjects, criteria, assignments, scores] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.criterion.findMany({ where: { sessionId }, select: { id: true, weight: true } }),
    prisma.assignment.findMany({ where: { sessionId }, select: { userId: true } }),
    prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true, value: true } }),
  ])

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
