import { prisma } from '@/lib/db'
import { addEvaluator, removeEvaluator } from '../../actions'

export default async function EvaluatorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignments = await prisma.assignment.findMany({
    where: { sessionId: id },
    include: { user: true },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">평가위원 배정</h1>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">이름</th><th className="p-2">아이디</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="p-2">{a.user.name}</td>
              <td className="p-2">{a.user.username}</td>
              <td className="p-2">
                <form action={async () => { 'use server'; await removeEvaluator(id, a.userId) }}>
                  <button className="text-red-600">배정 해제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={addEvaluator.bind(null, id)} className="grid grid-cols-3 gap-3 rounded border p-4">
        <input name="name" placeholder="이름" required className="rounded border px-3 py-2" />
        <input name="username" placeholder="아이디" required className="rounded border px-3 py-2" />
        <input name="password" placeholder="임시 비밀번호" required className="rounded border px-3 py-2" />
        <button className="col-span-3 rounded bg-gray-900 py-2 text-white">+ 위원 추가·배정</button>
      </form>
      <p className="text-xs text-gray-400">기존 아이디면 계정을 재사용하고 이 회차에 배정만 추가합니다.</p>
    </div>
  )
}
