'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveChairOpinion, confirmEvaluation, submitChairEvaluation } from '@/app/evaluate/actions'
import { SkeletonTable } from '@/components/Skeletons'
import SignaturePad from '@/components/SignaturePad'
import ReviewStepper, { stepsFromFlags } from '@/components/ReviewStepper'
import { CHAIR_REVIEW_STAGE_LABELS, chairReviewFlags } from '@/lib/submission'
import type { ChairSubjectData } from '@/lib/evaluate-data'

// 위원장 진행 스텝 — 평가의견 작성 → 종합의견 작성(현 페이지) → 제출 → 담당자 검토 → 관리자 검토.
// 종합의견은 실시간(입력 즉시) 반영되도록 opinion 상태로 판정한다.
function buildChairSteps(data: ChairSubjectData, opinion: string) {
  const chair = data.evaluators.find((e) => e.isChair)
  const flags = chairReviewFlags({
    status: data.chairSubmissionStatus,
    scored: chair?.state === 'complete',
    opinionWritten: opinion.trim().length > 0,
    sessionClosed: data.lockReason === 'closed',
  })
  return stepsFromFlags(CHAIR_REVIEW_STAGE_LABELS, flags)
}

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
  // 의견 상세 모달 / 검토완료 확인 대상 / 확인 처리 중인 위원
  const [detail, setDetail] = useState<
    { name: string; kind: 'opinion' | 'group'; opinion: string | null; groupComments: { groupName: string; text: string }[] } | null
  >(null)
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  // 제출(종합의견 페이지에서 서명과 함께 확정)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitSig, setSubmitSig] = useState<string | null>(null)
  const [submitErr, setSubmitErr] = useState('')

  useEffect(() => {
    let ignore = false
    setData(null)
    setStatus('idle')
    setLoadError(false)
    fetch(
      `/api/evaluate/chair/subject?sessionId=${encodeURIComponent(sessionId)}&subjectId=${encodeURIComponent(subjectId)}`,
      { cache: 'no-store' },
    )
      .then((r) => {
        // 403(위원장 아님)만 목록으로 돌려보낸다. 서버 오류까지 리다이렉트하면
        // 화면이 이유 없이 튕기는 것처럼 보여 원인을 찾기 어렵다.
        if (r.status === 403) { if (!ignore) router.replace('/evaluate'); return null }
        return r.ok ? r.json() : Promise.reject(r.status)
      })
      .then((d: ChairSubjectData | null) => {
        if (ignore || !d) return
        setData(d)
        setOpinion(d.chairOpinion)
      })
      .catch(() => { if (!ignore) setLoadError(true) })
    return () => { ignore = true }
  }, [sessionId, subjectId, router])

  // '예'를 눌러야 실제로 확인이 기록된다
  const onConfirm = () => {
    if (!confirmTarget) return
    const target = confirmTarget
    setConfirming(target.id)
    start(async () => {
      const res = await confirmEvaluation(sessionId, subjectId, target.id)
      setConfirming(null)
      setConfirmTarget(null)
      if (res?.ok) {
        setData((d) =>
          d ? { ...d, evaluators: d.evaluators.map((e) => (e.id === target.id ? { ...e, chairConfirmed: true } : e)) } : d,
        )
      } else {
        setStatus('error')
        setErrorMsg(res?.error ?? '확인에 실패했습니다.')
      }
    })
  }

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

  const onSubmit = () => {
    setSubmitErr('')
    const fd = new FormData()
    fd.set('opinion', opinion)
    if (submitSig) fd.set('signature', submitSig)
    start(async () => {
      const res = await submitChairEvaluation(sessionId, subjectId, fd)
      if (res?.ok) {
        setSubmitOpen(false)
        setData((d) => (d ? { ...d, chairSubmissionStatus: 'SUBMITTED', chairOpinion: opinion } : d))
      } else {
        setSubmitErr(res?.error ?? '제출에 실패했습니다.')
      }
    })
  }

  // 위원장 본인 제출/점수 상태
  const chairSubmitted = data?.chairSubmissionStatus === 'SUBMITTED' || data?.chairSubmissionStatus === 'APPROVED'
  const chairScored = data?.evaluators.find((e) => e.isChair)?.state === 'complete'
  const chairEditable = !!data && !data.locked && !chairSubmitted

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
              {data?.projectName ? `${data.projectName} · ` : ''}{data?.sessionName ?? ''} · 위원장 종합의견
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

      {loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
          평가 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      ) : !data ? (
        <SkeletonTable rows={4} cols={5} />
      ) : (
        <div className="space-y-4">
          {/* 진행 단계 — 종합의견을 작성하면 '종합의견 작성' 단계가 표시된다 */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-5 py-3">
            <ReviewStepper steps={buildChairSteps(data, opinion)} />
          </div>

          {/* 위원별 평가 — 본문은 '자세히 보기' 모달로 본다(표가 길어지지 않도록) */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 font-medium">평가위원명</th>
                  <th className="px-4 py-2.5 font-medium">점수</th>
                  <th className="px-4 py-2.5 font-medium">제출 여부</th>
                  <th className="px-4 py-2.5 font-medium">종합의견</th>
                  <th className="px-4 py-2.5 font-medium">항목별 의견</th>
                  <th className="px-4 py-2.5 font-medium">위원장 확인</th>
                </tr>
              </thead>
              <tbody>
                {data.evaluators.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
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
                    <td className="px-4 py-3">
                      {e.submitted ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">제출</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">미제출</span>
                      )}
                    </td>
                    {/* 위원장 본인 행에는 자기 의견을 보여주지 않는다(아래에서 직접 작성) */}
                    <td className="px-4 py-3">
                      {e.isChair ? (
                        <span className="text-slate-300">—</span>
                      ) : e.opinion ? (
                        <button
                          type="button"
                          onClick={() => setDetail({ name: e.name, kind: 'opinion', opinion: e.opinion, groupComments: e.groupComments })}
                          className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                        >
                          자세히 보기
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {e.isChair ? (
                        <span className="text-slate-300">—</span>
                      ) : e.groupComments.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetail({ name: e.name, kind: 'group', opinion: e.opinion, groupComments: e.groupComments })}
                          className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                        >
                          자세히 보기
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {e.isChair ? (
                        <span className="text-slate-300">—</span>
                      ) : e.chairConfirmed ? (
                        <span className="text-sm font-medium text-slate-900">확인 완료</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!e.submitted || confirming === e.id}
                          title={e.submitted ? undefined : '위원이 제출해야 확인할 수 있습니다'}
                          onClick={() => setConfirmTarget({ id: e.id, name: e.name })}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
                        >
                          {confirming === e.id ? '처리 중…' : '검토완료'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 아래: 위원장 종합의견 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">위원장 종합의견</span>
              <span className="text-xs text-slate-400">{opinion.length}자</span>
            </div>
            <textarea
              aria-label="위원장 종합의견"
              value={opinion}
              onChange={(e) => { setOpinion(e.target.value); setStatus('idle') }}
              disabled={!chairEditable}
              rows={8}
              placeholder="여러 위원의 평가를 종합한 위원장 종합의견을 작성하세요."
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
            />
            <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
              {!chairEditable && (
                <span className="mr-auto text-xs text-slate-400">
                  {chairSubmitted
                    ? '제출되었습니다. 관리자만 재오픈할 수 있습니다.'
                    : data.lockReason === 'opinionReviewed'
                      ? '평가의견서가 제출/승인되었습니다. 수정할 수 없습니다.'
                      : '마감된 분과입니다. 수정할 수 없습니다.'}
                </span>
              )}
              {chairEditable && status === 'saved' && <span className="text-xs text-emerald-600">저장되었습니다.</span>}
              {chairEditable && status === 'error' && <span className="text-xs text-rose-600">{errorMsg}</span>}
              {chairEditable && !chairScored && (
                <span className="text-xs text-slate-400">평가표에서 모든 항목을 입력해야 제출할 수 있습니다.</span>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={!chairEditable || pending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {pending ? '저장 중…' : '종합의견 저장'}
              </button>
              <button
                type="button"
                onClick={() => { setSubmitSig(null); setSubmitErr(''); setSubmitOpen(true); }}
                disabled={!chairEditable || pending || !opinion.trim() || !chairScored}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
                title={!opinion.trim() ? '종합의견을 작성하세요' : !chairScored ? '평가표에서 모든 항목을 입력하세요' : undefined}
              >
                {chairSubmitted ? '제출됨' : '제출 →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 제출 확인 모달 — 서명 필수 */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs text-slate-400">제출 확인 · 제출 후에는 관리자만 재오픈할 수 있습니다</div>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{data?.subjectName} 종합의견을 제출할까요?</h3>
            <p className="mt-2 text-sm text-slate-500">본인 평가 점수와 종합의견이 함께 제출됩니다.</p>
            <div className="mt-4">
              <div className="mb-1.5 text-sm font-medium text-slate-700">
                제출 서명 <span className="text-xs font-normal text-slate-400">— 평가표의 (인) 자리에 들어갑니다</span>
              </div>
              <SignaturePad onChange={setSubmitSig} width={352} height={110} />
            </div>
            {submitErr && <p className="mt-2 text-xs text-rose-600">{submitErr}</p>}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitOpen(false)}
                disabled={pending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={pending || !submitSig}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {pending ? '제출 중…' : '제출'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 의견 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4">
          <div className="my-8 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-800">
                {detail.name} — {detail.kind === 'opinion' ? '종합의견' : '항목별 의견'}
              </h3>
              <button type="button" onClick={() => setDetail(null)} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="닫기">✕</button>
            </div>
            {detail.kind === 'opinion' ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{detail.opinion}</p>
            ) : (
              <ul className="space-y-3">
                {detail.groupComments.map((gc, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="text-xs font-semibold text-slate-500">{gc.groupName}</div>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{gc.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 검토완료 확인 */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">검토완료</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {confirmTarget.name} 평가위원의 종합 점수와 종합의견을 확인하셨습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                아니오
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming !== null}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {confirming ? '처리 중…' : '예'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
