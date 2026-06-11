import { prisma } from '@/lib/db'
import StatCard from '@/components/StatCard'

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [subjects, criteria, assignments, scores] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } }),
    prisma.criterion.findMany({ where: { sessionId: id } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: true } }),
    prisma.score.findMany({ where: { sessionId: id }, select: { evaluatorId: true, subjectId: true, criterionId: true } }),
  ])

  const totalCriteria = criteria.length
  // (evaluatorId, subjectId) -> 입력한 항목 수
  const doneCount = new Map<string, number>()
  for (const s of scores) {
    const key = `${s.evaluatorId}:${s.subjectId}`
    doneCount.set(key, (doneCount.get(key) ?? 0) + 1)
  }

  const cellState = (evId: string, subId: string): 'done' | 'partial' | 'none' => {
    const n = doneCount.get(`${evId}:${subId}`) ?? 0
    if (totalCriteria > 0 && n >= totalCriteria) return 'done'
    if (n > 0) return 'partial'
    return 'none'
  }

  const totalCells = assignments.length * subjects.length
  let doneCells = 0
  for (const a of assignments) for (const s of subjects) if (cellState(a.userId, s.id) === 'done') doneCells++
  const completedEvaluators = assignments.filter((a) => subjects.length > 0 && subjects.every((s) => cellState(a.userId, s.id) === 'done')).length
  const pct = totalCells > 0 ? Math.round((doneCells / totalCells) * 100) : 0

  const dot = { done: 'bg-emerald-500', partial: 'bg-amber-400', none: 'bg-slate-200' } as const
  const label = { done: '완료', partial: '입력중', none: '미입력' } as const

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="전체 진행률" value={`${pct}%`} accent hint={`${doneCells}/${totalCells} 칸 완료`} />
        <StatCard label="입력 완료 위원" value={`${completedEvaluators}/${assignments.length}`} />
        <StatCard label="평가 항목" value={`${totalCriteria}개`} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">위원 \ 대상</th>
              {subjects.map((s) => (
                <th key={s.id} className="px-3 py-3 text-center font-medium">{s.name}</th>
              ))}
              <th className="px-4 py-3 text-center font-medium">완료율</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const done = subjects.filter((s) => cellState(a.userId, s.id) === 'done').length
              const rowPct = subjects.length > 0 ? Math.round((done / subjects.length) * 100) : 0
              return (
                <tr key={a.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{a.user.name}</td>
                  {subjects.map((s) => {
                    const st = cellState(a.userId, s.id)
                    return (
                      <td key={s.id} className="px-3 py-3 text-center">
                        <span className="inline-flex flex-col items-center gap-1">
                          <span className={`h-3 w-3 rounded-full ${dot[st]}`} title={label[st]} />
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center font-medium text-slate-700">{rowPct}%</td>
                </tr>
              )
            })}
            {assignments.length === 0 && (
              <tr><td colSpan={subjects.length + 2} className="px-5 py-10 text-center text-slate-400">배정된 평가위원이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" /> 완료</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400" /> 입력중</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-slate-200" /> 미입력</span>
      </div>
    </div>
  )
}
