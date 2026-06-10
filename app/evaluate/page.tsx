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
      <h1 className="text-2xl font-bold">평가 대상</h1>
      {assignments.length === 0 && <p className="text-gray-400">진행 중인 배정 회차가 없습니다.</p>}
      {assignments.map((a) => (
        <section key={a.id} className="space-y-3">
          <h2 className="font-semibold">{a.session.name}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {a.session.subjects.map((sub) => {
              const total = a.session.criteria.length
              const done = a.session.criteria.filter((c) => doneByCriterion.has(`${sub.id}:${c.id}`)).length
              const complete = total > 0 && done === total
              return (
                <Link key={sub.id} href={`/evaluate/${a.session.id}/${sub.id}`} className="rounded border p-4 hover:bg-gray-50">
                  <div className="font-medium">{sub.name}</div>
                  <div className={`text-sm ${complete ? 'text-green-600' : 'text-gray-400'}`}>
                    {complete ? '입력 완료' : `${done}/${total} 입력`}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
