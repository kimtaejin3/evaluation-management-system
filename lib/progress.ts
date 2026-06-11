import { prisma } from './db'

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
