'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CompanyLogo from '@/components/CompanyLogo'
import CriteriaAccordion from '@/components/CriteriaAccordion'
import { SkeletonCardGrid } from '@/components/Skeletons'
import type { HomeSession } from '@/lib/evaluate-data'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const fmtDeadline = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

export default function EvaluateHomeClient({ submitted }: { submitted?: string }) {
  const [name, setName] = useState('')
  const [sessions, setSessions] = useState<HomeSession[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false
    fetch('/api/evaluate/home')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { evaluatorName: string; sessions: HomeSession[] }) => {
        if (ignore) return
        setName(d.evaluatorName)
        setSessions(d.sessions)
      })
      .catch(() => { if (!ignore) setError(true) })
    return () => { ignore = true }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      {submitted && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="m4 10 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <b>{submitted}</b> 평가가 제출되었습니다.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">평가 대상 목록</h1>
        <p className="mt-1 text-sm text-slate-500">{name ? `${name} 위원님, ` : ''}대상을 선택해 평가를 진행하세요.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">목록을 불러오지 못했습니다.</div>
      )}
      {!error && sessions === null && <SkeletonCardGrid count={2} lines={4} cols="" />}
      {!error && sessions?.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">진행 중인 배정 심사가 없습니다.</div>
      )}

      {sessions?.map((s) => {
        const pct = s.totalSubjects > 0 ? Math.round((s.doneSubjects / s.totalSubjects) * 100) : 0
        const deadline = fmtDeadline(s.eventDate)
        return (
          <section key={s.assignmentId} className="space-y-3">
            {/* 상태바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[var(--gov-navy)] px-5 py-3 text-white">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{s.sessionName}</span>
                <span className="text-xs text-slate-300">{name} 위원</span>
                {s.isChair && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white">위원장</span>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                {s.isChair && (
                  <Link href={`/evaluate/${s.sessionId}/chair`} className="rounded-md border border-white/40 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/10">
                    총괄평가 →
                  </Link>
                )}
                <span className="text-slate-200">{s.doneSubjects}/{s.totalSubjects} 완료</span>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                </div>
                {deadline && <span className="text-xs text-slate-300">마감 {deadline}</span>}
              </div>
            </div>

            {/* 평가 항목 (아코디언) */}
            <CriteriaAccordion criteria={s.criteria} />

            {/* 대상 카드 리스트 */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {s.subjects.map((sub, i) => (
                <div key={sub.id} className="border-b border-slate-100 px-5 py-4 transition last:border-0 hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <span className="w-6 shrink-0 text-sm font-semibold text-slate-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    <CompanyLogo name={sub.name} className="h-9 w-9" />
                    <Link href={`/evaluate/${s.sessionId}/${sub.id}`} className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-800">{sub.name}</div>
                      {sub.description && <div className="truncate text-xs text-slate-400">{sub.description}</div>}
                    </Link>
                    {sub.status === 'complete' && (
                      <div className="text-right">
                        <div className="text-xs text-slate-400">점수</div>
                        <div className="text-lg font-bold text-slate-800 tabular-nums">{fmt(sub.score!)}</div>
                      </div>
                    )}
                    <div className="flex w-36 shrink-0 items-center justify-end gap-2.5">
                      {sub.status === 'complete' ? (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">✓ 완료</span>
                      ) : sub.status === 'inProgress' ? (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">평가 중</span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">미평가</span>
                      )}
                      <Link href={`/evaluate/${s.sessionId}/${sub.id}`} className="shrink-0 whitespace-nowrap text-sm text-indigo-600">
                        {sub.status === 'complete' ? '수정' : sub.status === 'inProgress' ? '이어하기 →' : '평가 시작 →'}
                      </Link>
                    </div>
                  </div>
                  {sub.docs.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[3.5rem]">
                      <span className="text-xs text-slate-400">심사 서류</span>
                      {sub.docs.map((d) => (
                        <a key={d.id} href={`/viewer/${d.id}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-indigo-600 transition hover:bg-slate-100">
                          {d.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {s.subjects.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-400">등록된 대상이 없습니다.</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
