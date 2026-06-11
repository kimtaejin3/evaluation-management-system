import { prisma } from '@/lib/db'
import { addSubject, deleteSubject } from '../../actions'

const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default async function SubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const subjects = await prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">평가 대상</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-5 py-3 font-medium">대상명</th>
              <th className="px-5 py-3 font-medium">설명</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="px-5 py-3 text-slate-500">{s.description}</td>
                <td className="px-5 py-3 text-right">
                  <form action={async () => { 'use server'; await deleteSubject(id, s.id) }}>
                    <button disabled={locked} className="text-sm text-rose-600 hover:underline disabled:opacity-30">삭제</button>
                  </form>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">등록된 대상이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {locked ? (
        <p className="text-sm text-slate-400">마감된 회차는 대상을 수정할 수 없습니다.</p>
      ) : (
        <form action={addSubject.bind(null, id)} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="col-span-2 text-sm font-semibold text-slate-700">새 대상 추가</div>
          <input name="name" placeholder="대상명" required className={inputCls} />
          <input name="description" placeholder="설명(선택)" className={inputCls} />
          <button className="col-span-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
            + 대상 추가
          </button>
        </form>
      )}
    </div>
  )
}
