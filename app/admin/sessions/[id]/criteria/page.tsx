import { prisma } from '@/lib/db'
import { addCriterion, deleteCriterion } from '../../actions'

const TYPE_LABEL = { QUANTITATIVE: '정량', QUALITATIVE: '정성' } as const

export default async function CriteriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">평가 항목 관리</h1>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">항목명</th><th className="p-2">방식</th><th className="p-2">배점</th><th className="p-2">가중치</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2">{c.name}<div className="text-xs text-gray-400">{c.description}</div></td>
              <td className="p-2">{TYPE_LABEL[c.type]}</td>
              <td className="p-2">{c.maxScore}</td>
              <td className="p-2">{c.weight}</td>
              <td className="p-2">
                <form action={async () => { 'use server'; await deleteCriterion(id, c.id) }}>
                  <button disabled={locked} className="text-red-600 disabled:opacity-30">삭제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!locked && (
        <form action={addCriterion.bind(null, id)} className="grid grid-cols-2 gap-3 rounded border p-4">
          <input name="name" placeholder="항목명" required className="rounded border px-3 py-2" />
          <select name="type" className="rounded border px-3 py-2">
            <option value="QUANTITATIVE">정량 (점수 직접 입력)</option>
            <option value="QUALITATIVE">정성 (등급 선택)</option>
          </select>
          <input name="maxScore" type="number" step="any" placeholder="배점" required className="rounded border px-3 py-2" />
          <input name="weight" type="number" step="any" defaultValue={1} placeholder="가중치" className="rounded border px-3 py-2" />
          <input name="description" placeholder="설명(선택)" className="col-span-2 rounded border px-3 py-2" />
          <button className="col-span-2 rounded bg-gray-900 py-2 text-white">+ 항목 추가</button>
        </form>
      )}
    </div>
  )
}
