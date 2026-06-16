import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { computeWeightedScore } from '@/lib/scoring'
import CompanyLogo from '@/components/CompanyLogo'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default async function EvaluateHome({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const user = await getCurrentUser()
  if (!user) return null
  const { submitted } = await searchParams

  const assignments = await prisma.assignment.findMany({
    where: { userId: user.id, session: { status: 'IN_PROGRESS' } },
    include: {
      session: {
        include: {
          subjects: {
            orderBy: { order: 'asc' },
            include: {
              company: {
                include: {
                  documents: { orderBy: { createdAt: 'asc' }, select: { id: true, originalName: true, sessionId: true } },
                },
              },
            },
          },
          criteria: true,
        },
      },
    },
  })

  const myScores = await prisma.score.findMany({ where: { evaluatorId: user.id }, select: { subjectId: true, criterionId: true, value: true } })
  const rowsBySubject = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of myScores) {
    if (!rowsBySubject.has(s.subjectId)) rowsBySubject.set(s.subjectId, [])
    rowsBySubject.get(s.subjectId)!.push({ criterionId: s.criterionId, value: s.value })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      {submitted && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="m4 10 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <b>{submitted}</b> 평가가 제출되었습니다.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">평가 대상 목록</h1>
        <p className="mt-1 text-sm text-slate-500">{user.name} 위원님, 대상을 선택해 평가를 진행하세요.</p>
      </div>

      {assignments.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          진행 중인 배정 심사가 없습니다.
        </div>
      )}

      {assignments.map((a) => {
        const total = a.session.criteria.length
        const weights = a.session.criteria.map((c) => ({ id: c.id, weight: c.weight }))
        const doneSubjects = a.session.subjects.filter((sub) => total > 0 && (rowsBySubject.get(sub.id)?.length ?? 0) >= total).length
        const pct = a.session.subjects.length > 0 ? Math.round((doneSubjects / a.session.subjects.length) * 100) : 0
        const deadline = a.session.eventDate
          ? new Date(a.session.eventDate).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : null

        return (
          <section key={a.id} className="space-y-3">
            {/* 상태바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[var(--gov-navy)] px-5 py-3 text-white">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{a.session.name}</span>
                <span className="text-xs text-slate-300">{user.name} 위원</span>
                {a.session.chairId === user.id && (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white">위원장</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                {a.session.chairId === user.id && (
                  <Link href={`/evaluate/${a.session.id}/chair`} className="rounded-md border border-white/40 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/10">
                    총괄평가 →
                  </Link>
                )}
                <span className="text-slate-200">{doneSubjects}/{a.session.subjects.length} 완료</span>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                </div>
                {deadline && <span className="text-xs text-slate-300">마감 {deadline}</span>}
              </div>
            </div>

            {/* 대상 카드 리스트 */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {a.session.subjects.map((sub, i) => {
                const rows = rowsBySubject.get(sub.id) ?? []
                const done = rows.length
                const complete = total > 0 && done >= total
                const inProgress = done > 0 && !complete
                const score = complete ? computeWeightedScore(rows, weights) : null
                // 이 심사 전용 + 공통 자료
                const docs = sub.company.documents.filter((d) => d.sessionId === a.session.id || d.sessionId === null)
                return (
                  <div key={sub.id} className="border-b border-slate-100 px-5 py-4 transition last:border-0 hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <span className="w-6 shrink-0 text-sm font-semibold text-slate-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <CompanyLogo name={sub.name} className="h-9 w-9" />
                      <Link href={`/evaluate/${a.session.id}/${sub.id}`} className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">{sub.name}</div>
                        {sub.description && <div className="truncate text-xs text-slate-400">{sub.description}</div>}
                      </Link>
                      {complete && (
                        <div className="text-right">
                          <div className="text-xs text-slate-400">점수</div>
                          <div className="text-lg font-bold text-slate-800 tabular-nums">{fmt(score!)}</div>
                        </div>
                      )}
                      <div className="flex w-36 shrink-0 items-center justify-end gap-2.5">
                        {complete ? (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">✓ 완료</span>
                        ) : inProgress ? (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">평가 중</span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">미평가</span>
                        )}
                        <Link href={`/evaluate/${a.session.id}/${sub.id}`} className="shrink-0 whitespace-nowrap text-sm text-indigo-600">{complete ? '수정' : inProgress ? '이어하기 →' : '평가 시작 →'}</Link>
                      </div>
                    </div>
                    {/* 심사 자료 */}
                    {docs.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[3.5rem]">
                        <span className="text-xs text-slate-400">심사 서류</span>
                        {docs.map((d) => (
                          <a
                            key={d.id}
                            href={`/viewer/${d.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-indigo-600 transition hover:bg-slate-100"
                          >
                            📄 {d.originalName}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {a.session.subjects.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-400">등록된 대상이 없습니다.</div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
