import { prisma } from '@/lib/db'
import { addSubject, deleteSubject } from '../../actions'

export default async function SubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const subjects = await prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">평가 대상 관리</h1>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">#</th><th className="p-2">대상명</th><th className="p-2">설명</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s.id} className="border-t">
              <td className="p-2">{i + 1}</td>
              <td className="p-2">{s.name}</td>
              <td className="p-2 text-gray-500">{s.description}</td>
              <td className="p-2">
                <form action={async () => { 'use server'; await deleteSubject(id, s.id) }}>
                  <button disabled={locked} className="text-red-600 disabled:opacity-30">삭제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!locked && (
        <form action={addSubject.bind(null, id)} className="grid grid-cols-2 gap-3 rounded border p-4">
          <input name="name" placeholder="대상명" required className="rounded border px-3 py-2" />
          <input name="description" placeholder="설명(선택)" className="rounded border px-3 py-2" />
          <button className="col-span-2 rounded bg-gray-900 py-2 text-white">+ 대상 추가</button>
        </form>
      )}
    </div>
  )
}
