import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export default async function EvaluateHome() {
  const user = await getCurrentUser()
  if (!user) return null

  const assignments = await prisma.assignment.findMany({
    where: { userId: user.id, session: { status: 'IN_PROGRESS' } },
    include: {
      session: { include: { subjects: { orderBy: { order: 'asc' } }, criteria: true } },
    },
  })

  const myScores = await prisma.score.findMany({ where: { evaluatorId: user.id }, select: { subjectId: true, criterionId: true } })
  const doneByCriterion = new Set(myScores.map((s) => `${s.subjectId}:${s.criterionId}`))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">평가 대상</h1>
        <p className="mt-1 text-sm text-slate-500">{user.name}님, 배정된 대상을 평가해 주세요.</p>
      </div>

      {assignments.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          진행 중인 배정 회차가 없습니다.
        </div>
      )}

      {assignments.map((a) => (
        <section key={a.id} className="space-y-3">
          <h2 className="font-semibold text-slate-700">{a.session.name}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {a.session.subjects.map((sub) => {
              const total = a.session.criteria.length
              const done = a.session.criteria.filter((c) => doneByCriterion.has(`${sub.id}:${c.id}`)).length
              const complete = total > 0 && done === total
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <Link
                  key={sub.id}
                  href={`/evaluate/${a.session.id}/${sub.id}`}
                  className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-800">{sub.name}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {complete ? '완료' : '진행 전'}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${complete ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 text-xs text-slate-400">{done}/{total} 항목 입력</div>
                </Link>
              )
            })}
            {a.session.subjects.length === 0 && (
              <div className="text-sm text-slate-400">등록된 대상이 없습니다.</div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
