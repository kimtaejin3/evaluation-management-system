import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getSessionProgress, getSessionInsights } from '@/lib/progress'
import { parseGradeOptions, defaultGradeOptions } from '@/lib/scoring'
import StatusBadge from '@/components/StatusBadge'
import MonitoringGrid from '@/components/MonitoringGrid'
import DashboardInsights from '@/components/DashboardInsights'
import LiveRefresher from '@/components/LiveRefresher'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function SecretarySession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  if (!session) notFound()

  const [p, insights, assignments, chair, criteria, subjects] = await Promise.all([
    getSessionProgress(id),
    getSessionInsights(id),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: { select: { id: true, name: true, username: true } } } }),
    session.chairId ? prisma.user.findUnique({ where: { id: session.chairId }, select: { name: true } }) : Promise.resolve(null),
    prisma.criterion.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } }),
    prisma.subject.findMany({
      where: { sessionId: id },
      orderBy: { order: 'asc' },
      include: {
        company: { include: { documents: { where: { OR: [{ sessionId: id }, { sessionId: null }] }, orderBy: { createdAt: 'asc' } } } },
      },
    }),
  ])

  // 평가 항목 — 구분(섹션)별 그룹
  const NO_SECTION = '미분류'
  const critGroups: { section: string; items: typeof criteria }[] = []
  for (const c of criteria) {
    const key = c.section || NO_SECTION
    const last = critGroups[critGroups.length - 1]
    if (last && last.section === key) last.items.push(c)
    else critGroups.push({ section: key, items: [c] })
  }
  const totalScore = criteria.reduce((s, c) => s + c.maxScore, 0)
  let critNo = 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">{session.name}</h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            <span className="text-slate-400">평가 일시</span>{' '}
            <span className="font-medium text-slate-700">
              {session.eventDate ? new Date(session.eventDate).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '미정'}
            </span>
          </p>
        </div>
        <LiveRefresher sessionId={id} />
      </div>

      {/* KPI */}
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

      {/* 실시간 모니터링 */}
      <MonitoringGrid data={p} />

      {/* 잠정 순위 · 편차 */}
      <DashboardInsights data={insights} sessionId={id} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 배정 위원 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 text-sm font-semibold text-slate-700">배정 평가위원 ({assignments.length})</div>
          <ul className="space-y-1.5 text-sm">
            {assignments.map((a) => (
              <li key={a.userId} className="flex items-center justify-between">
                <span className="text-slate-700">
                  {a.user.name}
                  {a.userId === session.chairId && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">위원장</span>}
                </span>
                <span className="text-xs text-slate-400">{a.user.username}</span>
              </li>
            ))}
            {assignments.length === 0 && <li className="text-slate-400">배정된 위원이 없습니다.</li>}
          </ul>
        </div>

        {/* 위원장 총괄평가 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">위원장 총괄평가</span>
            {chair && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{chair.name} 위원장</span>}
          </div>
          {session.chairSummary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{session.chairSummary}</p>
          ) : (
            <p className="text-sm text-slate-400">{session.chairId ? '아직 작성된 총괄평가가 없습니다.' : '위원장이 지정되지 않았습니다.'}</p>
          )}
        </div>
      </div>

      {/* 평가 항목 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">평가 항목 <span className="ml-0.5 text-xs text-slate-400">{criteria.length}개</span></h2>
          <span className="text-xs text-slate-400">전체 배점 {totalScore}점</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="w-px whitespace-nowrap px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">세부항목 · 평가기준</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 font-medium">방식</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">배점</th>
                <th className="px-4 py-2.5 font-medium">등급별 환산점수</th>
              </tr>
            </thead>
            <tbody>
              {critGroups.map((g) => (
                <Fragment key={g.section}>
                  <tr className="bg-slate-50/70">
                    <td colSpan={5} className="px-4 py-2">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">항목</span>
                      <span className="ml-2 text-sm font-semibold text-slate-700">{g.section}</span>
                    </td>
                  </tr>
                  {g.items.map((c) => {
                    critNo += 1
                    const isQual = c.type === 'QUALITATIVE'
                    const opts = isQual ? (parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)) : []
                    return (
                      <tr key={c.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="px-4 py-3 text-slate-400 tabular-nums">{critNo}</td>
                        <td className="px-4 py-3">
                          <div className="pl-3 font-medium text-slate-800">{c.name}</div>
                          {c.description && <div className="mt-0.5 pl-3 text-xs text-slate-400">{c.description}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${isQual ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>{isQual ? '정성' : '정량'}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{c.maxScore}</td>
                        <td className="px-4 py-3">
                          {isQual ? (
                            <div className="flex flex-wrap gap-1.5">
                              {opts.map((o, k) => (
                                <span key={k} className="inline-flex items-baseline gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                                  <span className="font-medium text-slate-700">{o.label}</span>
                                  <span className="text-slate-400 tabular-nums">{o.points}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">0 ~ {c.maxScore}점 직접 입력</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
              {criteria.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">등록된 평가 항목이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 심사 자료 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">심사 자료</h2>
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          {subjects.map((s) => (
            <div key={s.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="mb-1.5 text-sm font-medium text-slate-800">{s.name}</div>
              {s.company.documents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {s.company.documents.map((d) => (
                    <a
                      key={d.id}
                      href={`/viewer/${d.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-indigo-600 transition hover:bg-slate-100"
                    >
                      📄 {d.originalName}
                      <span className="text-xs text-slate-400">{formatSize(d.size)}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${d.sessionId ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>{d.sessionId ? '이 심사' : '공통'}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">등록된 자료가 없습니다.</p>
              )}
            </div>
          ))}
          {subjects.length === 0 && <p className="text-sm text-slate-400">평가 대상이 없습니다.</p>}
        </div>
      </div>
    </div>
  )
}
