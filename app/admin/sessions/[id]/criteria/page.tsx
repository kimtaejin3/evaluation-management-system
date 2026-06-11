import { prisma } from '@/lib/db'
import { deleteCriterion } from '../../actions'
import { parseGradeOptions, defaultGradeOptions } from '@/lib/scoring'
import AddCriterionForm from '@/components/AddCriterionForm'

const TYPE_LABEL = { QUANTITATIVE: '정량', QUALITATIVE: '정성' } as const

export default async function CriteriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">평가 항목</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">항목명</th>
              <th className="px-5 py-3 font-medium">방식</th>
              <th className="px-5 py-3 font-medium">배점</th>
              <th className="px-5 py-3 font-medium">가중치</th>
              <th className="px-5 py-3 font-medium">답(척도)</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const opts = c.type === 'QUALITATIVE' ? (parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)) : null
              return (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 align-top">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800">{c.name}</div>
                    {c.description && <div className="text-xs text-slate-400">{c.description}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.type === 'QUALITATIVE' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                      {TYPE_LABEL[c.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.maxScore}</td>
                  <td className="px-5 py-3 text-slate-600">{c.weight}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {c.type === 'QUANTITATIVE' ? (
                      <span className="text-xs">0 ~ {c.maxScore}점 직접 입력</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {opts!.map((o, i) => (
                          <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                            {o.label} <span className="text-slate-400">{o.points}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <form action={async () => { 'use server'; await deleteCriterion(id, c.id) }}>
                      <button disabled={locked} className="text-sm text-rose-600 hover:underline disabled:opacity-30">삭제</button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {criteria.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">등록된 항목이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {locked ? (
        <p className="text-sm text-slate-400">마감된 회차는 항목을 수정할 수 없습니다.</p>
      ) : (
        <div className="max-w-2xl">
          <AddCriterionForm sessionId={id} />
        </div>
      )}
    </div>
  )
}
