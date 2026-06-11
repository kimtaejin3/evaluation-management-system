import { prisma } from './db'

export type CellState = 'done' | 'partial' | 'none'

export interface ProgressData {
  subjects: { id: string; name: string }[]
  totalCriteria: number
  rows: {
    userId: string
    name: string
    cells: { subjectId: string; state: CellState }[]
    donePct: number
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
    prisma.criterion.findMany({ where: { sessionId }, select: { id: true } }),
    prisma.assignment.findMany({ where: { sessionId }, include: { user: true } }),
    prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true } }),
  ])

  const totalCriteria = criteria.length
  const doneCount = new Map<string, number>()
  for (const s of scores) {
    const key = `${s.evaluatorId}:${s.subjectId}`
    doneCount.set(key, (doneCount.get(key) ?? 0) + 1)
  }
  const stateOf = (evId: string, subId: string): CellState => {
    const n = doneCount.get(`${evId}:${subId}`) ?? 0
    if (totalCriteria > 0 && n >= totalCriteria) return 'done'
    if (n > 0) return 'partial'
    return 'none'
  }

  const rows = assignments.map((a) => {
    const cells = subjects.map((s) => ({ subjectId: s.id, state: stateOf(a.userId, s.id) }))
    const done = cells.filter((c) => c.state === 'done').length
    return {
      userId: a.userId,
      name: a.user.name,
      cells,
      donePct: subjects.length > 0 ? Math.round((done / subjects.length) * 100) : 0,
    }
  })

  const subjectSummary = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    done: assignments.filter((a) => stateOf(a.userId, s.id) === 'done').length,
    total: assignments.length,
  }))

  const totalCells = assignments.length * subjects.length
  let doneCells = 0
  for (const r of rows) doneCells += r.cells.filter((c) => c.state === 'done').length
  const completedEvaluators = rows.filter((r) => subjects.length > 0 && r.cells.every((c) => c.state === 'done')).length

  return {
    subjects,
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
