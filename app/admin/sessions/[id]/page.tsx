import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { duplicateSession } from '../actions'
import { getSessionProgress, getSessionInsights } from '@/lib/progress'
import MonitoringGrid from '@/components/MonitoringGrid'
import DashboardInsights from '@/components/DashboardInsights'
import LiveRefresher from '@/components/LiveRefresher'
import SessionStatusControl from '@/components/SessionStatusControl'
import { SkeletonCard, SkeletonStats, SkeletonTable } from '@/components/Skeletons'

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <Suspense fallback={<SkeletonCard lines={4} />}>
        <SessionInfo id={id} />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
            <SkeletonStats count={4} colsClass="sm:grid-cols-4" />
            <SkeletonTable rows={4} cols={4} />
          </div>
        }
      >
        <MonitoringSection id={id} />
      </Suspense>
    </div>
  )
}

// 심사 정보 카드 (단일 쿼리)
async function SessionInfo({ id }: { id: string }) {
  const session = await prisma.evaluationSession.findUnique({
    where: { id },
    include: { _count: { select: { criteria: true, subjects: true, assignments: true } } },
  })
  if (!session) notFound()

  const meta: { label: string; value: string }[] = [
    { label: '일시', value: session.eventDate ? new Date(session.eventDate).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
    { label: '장소', value: session.location || '—' },
    { label: '평가 항목', value: `${session._count.criteria}개` },
    { label: '평가 대상', value: `${session._count.subjects}개` },
    { label: '평가위원', value: `${session._count.assignments}명` },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">심사 정보</h2>
        <form action={async () => { 'use server'; await duplicateSession(id) }}>
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50">심사 복사</button>
        </form>
      </div>
      {session.description && <p className="mb-4 text-sm text-slate-600">{session.description}</p>}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {meta.map((m) => (
          <div key={m.label}>
            <dt className="text-slate-400">{m.label}</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{m.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-400">진행 상태</span>
        <SessionStatusControl
          sessionId={session.id}
          status={session.status}
          eventDate={session.eventDate ? session.eventDate.toISOString() : null}
        />
      </div>
    </div>
  )
}

// 실시간 모니터링 대시보드 (진행률 집계 — 무거운 쿼리)
async function MonitoringSection({ id }: { id: string }) {
  const [p, insights] = await Promise.all([getSessionProgress(id), getSessionInsights(id)])

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 className="font-semibold">실시간 모니터링</h2>
        <LiveRefresher sessionId={id} />
      </div>

      {/* KPI 스탯 스트립 */}
      <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-slate-200">
        {[
          { label: '배정 위원', value: `${p.assignedCount}명` },
          { label: '입력 완료 위원', value: `${p.completedEvaluators}/${p.assignedCount}` },
          { label: '진행률', value: `${p.pct}%`, accent: true, hint: `${p.doneCells}/${p.totalCells} 칸` },
          { label: '평가 대상', value: `${p.subjects.length}개` },
        ].map((k, i) => (
          <div key={k.label} className={i === 0 ? 'sm:pr-6' : 'sm:px-6'}>
            <div className="text-sm text-slate-500">{k.label}</div>
            <div className={`mt-1 text-2xl font-bold ${k.accent ? 'text-indigo-600' : 'text-slate-900'}`}>{k.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{k.hint ?? ' '}</div>
          </div>
        ))}
      </div>

      <MonitoringGrid data={p} />
      <DashboardInsights data={insights} sessionId={id} />
    </section>
  )
}
