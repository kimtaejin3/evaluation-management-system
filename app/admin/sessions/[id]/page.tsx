import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { setSessionStatus, duplicateSession } from '../actions'
import { canCloseSession } from '@/lib/session-rules'
import { getSessionProgress, getSessionInsights } from '@/lib/progress'
import MonitoringGrid from '@/components/MonitoringGrid'
import DashboardInsights from '@/components/DashboardInsights'
import LiveRefresher from '@/components/LiveRefresher'

const FLOW = [
  { key: 'DRAFT', label: '초안', desc: '항목·대상·위원을 설정합니다.' },
  { key: 'IN_PROGRESS', label: '진행중', desc: '평가위원이 점수를 입력합니다.' },
  { key: 'CLOSED', label: '마감', desc: '점수가 잠기고 결과가 확정됩니다.' },
] as const

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({
    where: { id },
    include: { _count: { select: { criteria: true, subjects: true, assignments: true } } },
  })
  if (!session) notFound()

  const p = await getSessionProgress(id)
  const insights = await getSessionInsights(id)

  const meta: { label: string; value: string }[] = [
    { label: '일시', value: session.eventDate ? new Date(session.eventDate).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
    { label: '장소', value: session.location || '—' },
    { label: '평가 항목', value: `${session._count.criteria}개` },
    { label: '평가 대상', value: `${session._count.subjects}개` },
    { label: '평가위원', value: `${session._count.assignments}명` },
  ]

  const links: { href: string; label: string; desc: string }[] = [
    { href: `/admin/sessions/${id}/criteria`, label: '평가 항목', desc: `${session._count.criteria}개 항목 · 배점·등급 설정` },
    { href: `/admin/sessions/${id}/subjects`, label: '평가 대상', desc: `${session._count.subjects}개 기업 편입·자료` },
    { href: `/admin/sessions/${id}/evaluators`, label: '평가위원', desc: `${session._count.assignments}명 배정` },
    { href: `/admin/sessions/${id}/progress`, label: '진행 현황', desc: '위원×대상 입력 모니터링' },
    { href: `/admin/sessions/${id}/results`, label: '집계 결과', desc: '순위·환산·등급 총괄표' },
    { href: `/admin/sessions/${id}/breakdown`, label: '산출 근거', desc: '항목 평균×가중치 내역' },
  ]

  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">심사 정보</h2>
          <form action={async () => { 'use server'; await duplicateSession(id) }}>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50">심사 복사</button>
          </form>
        </div>
        {session.description && <p className="mb-4 text-sm text-slate-600">{session.description}</p>}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {meta.map((m) => (
            <div key={m.label}>
              <dt className="text-slate-400">{m.label}</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">진행 상태</h2>
        <ol className="mb-5 space-y-3">
          {FLOW.map((f) => {
            const current = session.status === f.key
            return (
              <li key={f.key} className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    current ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  ●
                </span>
                <div>
                  <div className={`text-sm font-medium ${current ? 'text-indigo-600' : 'text-slate-600'}`}>{f.label}</div>
                  <div className="text-xs text-slate-400">{f.desc}</div>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-col gap-2">
          <form action={async () => { 'use server'; await setSessionStatus(id, 'IN_PROGRESS') }}>
            <button disabled={session.status !== 'DRAFT'} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50 disabled:opacity-40">
              평가 시작
            </button>
          </form>
          <form action={async () => { 'use server'; await setSessionStatus(id, 'CLOSED') }}>
            <button disabled={session.status !== 'IN_PROGRESS' || !canCloseSession(session.eventDate)} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
              마감·잠금
            </button>
          </form>
          {session.status === 'IN_PROGRESS' && !canCloseSession(session.eventDate) && (
            <p className="text-xs text-amber-600">평가 일시({new Date(session.eventDate!).toLocaleDateString('ko-KR')}) 이후에 마감할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>

    {/* 실시간 모니터링 대시보드 */}
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

    {/* 세부 화면 바로가기 */}
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">바로가기</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-indigo-300 hover:bg-indigo-50/30"
          >
            <div>
              <div className="font-medium text-slate-800">{l.label}</div>
              <div className="mt-0.5 text-xs text-slate-400">{l.desc}</div>
            </div>
            <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500">→</span>
          </Link>
        ))}
      </div>
    </div>
    </div>
  )
}
