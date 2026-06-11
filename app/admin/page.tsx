import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getSessionProgress } from '@/lib/progress'
import StatCard from '@/components/StatCard'
import StatusBadge from '@/components/StatusBadge'
import MonitoringGrid from '@/components/MonitoringGrid'
import Clock from '@/components/Clock'

export default async function AdminDashboard() {
  const session =
    (await prisma.evaluationSession.findFirst({ where: { status: 'IN_PROGRESS' }, orderBy: { createdAt: 'desc' } })) ??
    (await prisma.evaluationSession.findFirst({ orderBy: { createdAt: 'desc' } }))

  if (!session) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          아직 회차가 없습니다.{' '}
          <Link href="/admin/sessions/new" className="text-indigo-600 hover:underline">새 회차 만들기</Link>
        </div>
      </div>
    )
  }

  const p = await getSessionProgress(session.id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">현재 회차 진행 상황을 한눈에 확인하세요.</p>
      </div>

      {/* 상태바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">{session.name}</span>
          <StatusBadge status={session.status} />
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-slate-400">현재 시각 </span>
            <span className="font-semibold text-slate-800"><Clock /></span>
          </div>
          <div>
            <span className="text-slate-400">일시 </span>
            <span className="font-medium text-slate-700">
              {session.eventDate ? new Date(session.eventDate).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '미정'}
            </span>
          </div>
          <Link href={`/admin/sessions/${session.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">회차 관리 →</Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="배정 위원" value={`${p.assignedCount}명`} />
        <StatCard label="입력 완료 위원" value={`${p.completedEvaluators}/${p.assignedCount}`} />
        <StatCard label="진행률" value={`${p.pct}%`} accent hint={`${p.doneCells}/${p.totalCells} 칸`} />
        <StatCard label="평가 대상" value={`${p.subjects.length}개`} />
      </div>

      {/* 모니터링 그리드 */}
      <div className="space-y-2">
        <h2 className="font-semibold text-slate-700">위원 × 대상 모니터링</h2>
        <MonitoringGrid data={p} />
      </div>

      {/* 대상별 진행 요약 */}
      <div className="space-y-2">
        <h2 className="font-semibold text-slate-700">대상별 진행 요약</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-2.5 font-medium">대상</th>
                <th className="px-4 py-2.5 font-medium">입력 완료 위원</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {p.subjectSummary.map((s) => {
                const complete = s.total > 0 && s.done === s.total
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.done}/{s.total}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {complete ? '완료' : '진행중'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {p.subjectSummary.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">평가 대상이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
