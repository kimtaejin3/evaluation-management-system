'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveChairOpinion } from '@/app/evaluate/actions'
import { SkeletonTable } from '@/components/Skeletons'
import type { ChairSubjectData } from '@/lib/evaluate-data'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function ChairSubjectClient({
  sessionId,
  subjectId,
}: {
  sessionId: string
  subjectId: string
}) {
  const router = useRouter()
  const [data, setData] = useState<ChairSubjectData | null>(null)
  const [opinion, setOpinion] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => {
    let ignore = false
    setData(null)
    setStatus('idle')
    fetch(
      `/api/evaluate/chair/subject?sessionId=${encodeURIComponent(sessionId)}&subjectId=${encodeURIComponent(subjectId)}`,
      { cache: 'no-store' },
    )
      .then((r) => {
        if (r.status === 403) { if (!ignore) router.replace('/evaluate'); return null } // 위원장 아님
        return r.ok ? r.json() : Promise.reject(r.status)
      })
      .then((d: ChairSubjectData | null) => {
        if (ignore || !d) return
        setData(d)
        setOpinion(d.chairOpinion)
      })
      .catch(() => { if (!ignore) router.replace('/evaluate') })
    return () => { ignore = true }
  }, [sessionId, subjectId, router])

  const onSave = () => {
    setStatus('idle')
    const fd = new FormData()
    fd.set('opinion', opinion)
    start(async () => {
      const res = await saveChairOpinion(sessionId, subjectId, fd)
      if (res?.ok) {
        setStatus('saved')
      } else {
        setStatus('error')
        setErrorMsg(res?.error ?? '저장에 실패했습니다.')
      }
    })
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
      {/* 헤더 — 목록 복귀 + 대상명 + 이전/다음 대상 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/evaluate"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            ← 대상 목록
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data?.subjectName ?? ' '}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {data?.sessionName ?? ''} · 위원장 통합의견
            </p>
          </div>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            {data.prevSubjectId ? (
              <Link
                href={`/evaluate/${sessionId}/chair/${data.prevSubjectId}`}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                ← 이전 대상
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 px-2.5 py-1 text-sm text-slate-300">← 이전 대상</span>
            )}
            {data.nextSubjectId ? (
              <Link
                href={`/evaluate/${sessionId}/chair/${data.nextSubjectId}`}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                다음 대상 →
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 px-2.5 py-1 text-sm text-slate-300">다음 대상 →</span>
            )}
          </div>
        )}
      </div>

      {!data ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* 좌: 위원별 점수·의견·제출 유무 */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:self-start">
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 font-medium">평가위원명</th>
                  <th className="px-4 py-2.5 font-medium">종합점수</th>
                  <th className="px-4 py-2.5 font-medium">항목당 의견</th>
                  <th className="px-4 py-2.5 font-medium">제출 유무</th>
                </tr>
              </thead>
              <tbody>
                {data.evaluators.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                      배정된 평가위원이 없습니다.
                    </td>
                  </tr>
                )}
                {data.evaluators.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {e.name}
                      {e.isChair && <span className="ml-1 text-xs text-indigo-600">(위원장)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {e.total != null ? (
                        <span className="text-lg font-bold text-indigo-700 tabular-nums">{fmt(e.total)}</span>
                      ) : e.state === 'partial' ? (
                        <span className="text-xs text-amber-600">입력중</span>
                      ) : (
                        <span className="text-xs text-slate-400">입력전</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {e.groupComments.length === 0 ? (
                        <span className="text-xs text-slate-400">의견 없음</span>
                      ) : (
                        <ul className="space-y-1.5">
                          {e.groupComments.map((gc, i) => (
                            <li key={i}>
                              <div className="text-xs font-semibold text-slate-500">{gc.groupName}</div>
                              <p className="whitespace-pre-wrap text-sm text-slate-700">{gc.text}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={e.submitted ? 'text-slate-900' : 'text-rose-600'}>
                        {e.submitted ? '제출' : '미제출'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 우: 통합의견 작성 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6 lg:self-start">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">통합의견 (위원장)</span>
              <span className="text-xs text-slate-400">{opinion.length}자</span>
            </div>
            <textarea
              aria-label="통합의견"
              value={opinion}
              onChange={(e) => { setOpinion(e.target.value); setStatus('idle') }}
              disabled={data.locked}
              rows={14}
              placeholder="여러 위원의 평가를 종합한 위원장 통합의견을 작성하세요."
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
            />
            {data.locked ? (
              <p className="mt-3 text-xs text-slate-400">
                {data.lockReason === 'opinionReviewed'
                  ? '평가의견서가 제출/승인되었습니다. 수정할 수 없습니다.'
                  : '마감된 분과입니다. 수정할 수 없습니다.'}
              </p>
            ) : (
              <div className="mt-3 flex items-center justify-end gap-3">
                {status === 'saved' && <span className="text-xs text-emerald-600">저장되었습니다.</span>}
                {status === 'error' && <span className="text-xs text-rose-600">{errorMsg}</span>}
                <button
                  type="button"
                  onClick={onSave}
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {pending ? '저장 중…' : '통합의견 저장'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
