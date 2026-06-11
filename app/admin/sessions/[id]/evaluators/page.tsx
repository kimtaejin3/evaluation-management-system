import { prisma } from '@/lib/db'
import { addEvaluator, removeEvaluator } from '../../actions'

const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default async function EvaluatorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignments = await prisma.assignment.findMany({
    where: { sessionId: id },
    include: { user: true },
  })

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">배정된 평가위원</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">이름</th>
              <th className="px-5 py-3 font-medium">아이디</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                      {a.user.name.slice(0, 1)}
                    </span>
                    <span className="font-medium text-slate-800">{a.user.name}</span>
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">{a.user.username}</td>
                <td className="px-5 py-3 text-right">
                  <form action={async () => { 'use server'; await removeEvaluator(id, a.userId) }}>
                    <button className="text-sm text-rose-600 hover:underline">배정 해제</button>
                  </form>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">배정된 위원이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={addEvaluator.bind(null, id)} className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="col-span-3 text-sm font-semibold text-slate-700">위원 추가·배정</div>
        <input name="name" placeholder="이름" required className={inputCls} />
        <input name="username" placeholder="아이디" required className={inputCls} />
        <input name="password" placeholder="임시 비밀번호" required className={inputCls} />
        <button className="col-span-3 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          + 위원 추가·배정
        </button>
        <p className="col-span-3 text-xs text-slate-400">기존 아이디면 계정을 재사용하고 이 회차에 배정만 추가합니다.</p>
      </form>
    </div>
  )
}
