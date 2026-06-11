import { prisma } from '@/lib/db'
import { addCriterion, deleteCriterion } from '../../actions'

const TYPE_LABEL = { QUANTITATIVE: '정량', QUALITATIVE: '정성' } as const

const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default async function CriteriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">평가 항목</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">항목명</th>
              <th className="px-5 py-3 font-medium">방식</th>
              <th className="px-5 py-3 font-medium">배점</th>
              <th className="px-5 py-3 font-medium">가중치</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0">
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
                <td className="px-5 py-3 text-right">
                  <form action={async () => { 'use server'; await deleteCriterion(id, c.id) }}>
                    <button disabled={locked} className="text-sm text-rose-600 hover:underline disabled:opacity-30">삭제</button>
                  </form>
                </td>
              </tr>
            ))}
            {criteria.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">등록된 항목이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {locked ? (
        <p className="text-sm text-slate-400">마감된 회차는 항목을 수정할 수 없습니다.</p>
      ) : (
        <form action={addCriterion.bind(null, id)} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="col-span-2 text-sm font-semibold text-slate-700">새 항목 추가</div>
          <input name="name" placeholder="항목명" required className={inputCls} />
          <select name="type" className={inputCls}>
            <option value="QUANTITATIVE">정량 (점수 직접 입력)</option>
            <option value="QUALITATIVE">정성 (등급 선택)</option>
          </select>
          <input name="maxScore" type="number" step="any" placeholder="배점" required className={inputCls} />
          <input name="weight" type="number" step="any" defaultValue={1} placeholder="가중치" className={inputCls} />
          <input name="description" placeholder="설명(선택)" className={`col-span-2 ${inputCls}`} />
          <button className="col-span-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
            + 항목 추가
          </button>
        </form>
      )}
    </div>
  )
}
