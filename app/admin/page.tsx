import Link from 'next/link'
import { prisma } from '@/lib/db'

const STATUS_LABEL = { DRAFT: '초안', IN_PROGRESS: '진행중', CLOSED: '마감' } as const

export default async function AdminDashboard() {
  const sessions = await prisma.evaluationSession.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { subjects: true, criteria: true } } },
  })
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">심사 회차</h1>
        <Link href="/admin/sessions/new" className="rounded bg-gray-900 px-4 py-2 text-white">+ 새 회차</Link>
      </div>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">회차명</th><th className="p-2">상태</th><th className="p-2">항목</th><th className="p-2">대상</th></tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-2"><Link href={`/admin/sessions/${s.id}`} className="text-blue-600 underline">{s.name}</Link></td>
              <td className="p-2">{STATUS_LABEL[s.status]}</td>
              <td className="p-2">{s._count.criteria}</td>
              <td className="p-2">{s._count.subjects}</td>
            </tr>
          ))}
          {sessions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">회차가 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
