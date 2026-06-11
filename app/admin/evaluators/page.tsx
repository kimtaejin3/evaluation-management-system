import { prisma } from '@/lib/db'
import { createEvaluator, deleteEvaluator } from '../actions'

const inputCls = 'rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default async function EvaluatorsAdminPage() {
  const evaluators = await prisma.user.findMany({
    where: { role: 'EVALUATOR' },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { assignments: true } } },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">평가위원 관리</h1>
        <p className="mt-1 text-sm text-slate-500">전체 평가위원 계정을 관리합니다. 회차 배정은 회차별 화면에서 진행하세요.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">아이디</th>
              <th className="px-4 py-2.5 font-medium">배정 회차</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {evaluators.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                      {u.name.slice(0, 1)}
                    </span>
                    <span className="font-medium text-slate-800">{u.name}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{u.username}</td>
                <td className="px-4 py-2.5 text-slate-600">{u._count.assignments}개</td>
                <td className="px-4 py-2.5 text-right">
                  <form action={async () => { 'use server'; await deleteEvaluator(u.id) }}>
                    <button className="text-sm text-rose-600 hover:underline">삭제</button>
                  </form>
                </td>
              </tr>
            ))}
            {evaluators.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">등록된 평가위원이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={createEvaluator} className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="col-span-3 text-sm font-semibold text-slate-700">위원 계정 추가</div>
        <input name="name" placeholder="이름" required className={inputCls} />
        <input name="username" placeholder="아이디" required className={inputCls} />
        <input name="password" placeholder="임시 비밀번호" required className={inputCls} />
        <button className="col-span-3 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          + 위원 추가
        </button>
        <p className="col-span-3 text-xs text-slate-400">기존 아이디면 이름만 갱신합니다.</p>
      </form>
    </div>
  )
}
