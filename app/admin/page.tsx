import Link from 'next/link'
import { prisma } from '@/lib/db'
import StatCard from '@/components/StatCard'
import StatusBadge from '@/components/StatusBadge'

export default async function AdminDashboard() {
  const sessions = await prisma.evaluationSession.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { subjects: true, criteria: true, assignments: true } } },
  })
  const evaluatorCount = await prisma.user.count({ where: { role: 'EVALUATOR' } })
  const inProgress = sessions.filter((s) => s.status === 'IN_PROGRESS').length
  const closed = sessions.filter((s) => s.status === 'CLOSED').length

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">심사 회차 현황을 한눈에 확인하세요.</p>
        </div>
        <Link
          href="/admin/sessions/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        >
          + 새 회차
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 회차" value={sessions.length} />
        <StatCard label="진행중" value={inProgress} accent />
        <StatCard label="마감" value={closed} />
        <StatCard label="평가위원" value={evaluatorCount} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">심사 회차</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">회차명</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="px-5 py-3 font-medium">항목</th>
              <th className="px-5 py-3 font-medium">대상</th>
              <th className="px-5 py-3 font-medium">위원</th>
              <th className="px-5 py-3 font-medium">일시</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/admin/sessions/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                    {s.name}
                  </Link>
                  {s.location && <div className="text-xs text-slate-400">{s.location}</div>}
                </td>
                <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-5 py-3 text-slate-600">{s._count.criteria}</td>
                <td className="px-5 py-3 text-slate-600">{s._count.subjects}</td>
                <td className="px-5 py-3 text-slate-600">{s._count.assignments}</td>
                <td className="px-5 py-3 text-slate-500">
                  {s.eventDate ? new Date(s.eventDate).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  아직 회차가 없습니다. “+ 새 회차”로 시작하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
