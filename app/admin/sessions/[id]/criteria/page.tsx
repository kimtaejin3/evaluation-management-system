import { Fragment } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { deleteCriterion } from '../../actions'
import { parseGradeOptions, defaultGradeOptions } from '@/lib/scoring'
import AddCriterionForm from '@/components/AddCriterionForm'

export default async function CriteriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const activeTab = tab === 'qual' ? 'qual' : 'quant'
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  const quant = criteria.filter((c) => c.type === 'QUANTITATIVE')
  const qual = criteria.filter((c) => c.type === 'QUALITATIVE')
  const rows = activeTab === 'qual' ? qual : quant
  const subtotal = rows.reduce((s, c) => s + c.maxScore, 0)
  const totalAll = criteria.reduce((s, c) => s + c.maxScore, 0)

  // 대제목(섹션) 목록 + 현재 탭 행을 섹션별로 묶기
  const sectionNames = Array.from(new Set(criteria.map((c) => c.section).filter((s): s is string => !!s)))
  const NO_SECTION = '미분류'
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, c) => {
    const key = c.section || NO_SECTION
    ;(acc[key] ??= []).push(c)
    return acc
  }, {})
  const groupOrder = Object.keys(grouped).sort((a, b) => (a === NO_SECTION ? 1 : b === NO_SECTION ? -1 : 0))
  const colCount = (activeTab === 'qual' ? 5 : 4) + (locked ? 0 : 1)
  let rowNo = 0

  const tabCls = (on: boolean) =>
    `rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition ${
      on ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'
    }`

  return (
    <div className="space-y-5">
      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <Link href={`/admin/sessions/${id}/criteria?tab=quant`} className={tabCls(activeTab === 'quant')}>
          정량 항목 <span className="ml-0.5 text-xs text-slate-400">{quant.length}</span>
        </Link>
        <Link href={`/admin/sessions/${id}/criteria?tab=qual`} className={tabCls(activeTab === 'qual')}>
          정성 항목 <span className="ml-0.5 text-xs text-slate-400">{qual.length}</span>
        </Link>
        <div className="ml-auto pb-1 text-xs text-slate-400">전체 배점 합계 {totalAll}점</div>
      </div>

      {/* 표 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="w-px whitespace-nowrap px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">항목명 · 평가기준</th>
              <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">배점</th>
              <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">가중치</th>
              {activeTab === 'qual' && <th className="px-4 py-2.5 font-medium">등급별 환산점수 (답)</th>}
              {!locked && <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">관리</th>}
            </tr>
          </thead>
          <tbody>
            {groupOrder.map((sec) => {
              const groupRows = grouped[sec]
              const groupSum = groupRows.reduce((s, c) => s + c.maxScore, 0)
              return (
                <Fragment key={sec}>
                  <tr className="bg-slate-50/70">
                    <td colSpan={colCount} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">대제목</span>
                        <span className="text-sm font-semibold text-slate-700">{sec}</span>
                        <span className="text-xs text-slate-400">세부항목 {groupRows.length} · 배점 {groupSum}</span>
                      </div>
                    </td>
                  </tr>
                  {groupRows.map((c) => {
                    rowNo += 1
                    const opts = c.type === 'QUALITATIVE' ? (parseGradeOptions(c.gradeOptions) ?? defaultGradeOptions(c.maxScore)) : []
                    return (
                      <tr key={c.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="px-4 py-3 text-slate-400 tabular-nums">{rowNo}</td>
                        <td className="px-4 py-3">
                          <div className="pl-3 font-medium text-slate-800">{c.name}</div>
                          {c.description && <div className="mt-0.5 pl-3 text-xs text-slate-400">{c.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{c.maxScore}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">×{c.weight}</td>
                        {activeTab === 'qual' && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {opts.map((o, k) => (
                                <span key={k} className="inline-flex items-baseline gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                                  <span className="font-medium text-slate-700">{o.label}</span>
                                  <span className="text-slate-400 tabular-nums">{o.points}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        )}
                        {!locked && (
                          <td className="px-4 py-3 text-right">
                            <form action={async () => { 'use server'; await deleteCriterion(id, c.id) }}>
                              <button className="text-sm text-rose-600 hover:underline">삭제</button>
                            </form>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-slate-400">
                  {activeTab === 'qual' ? '정성' : '정량'} 항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-medium text-slate-700">
                <td className="px-4 py-2.5" colSpan={2}>합계 ({activeTab === 'qual' ? '정성' : '정량'})</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{subtotal}</td>
                <td className="px-4 py-2.5" colSpan={colCount - 3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 점수 기준 안내 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <div className="mb-1 font-semibold text-slate-600">점수 기준</div>
        <ul className="space-y-0.5">
          <li>· 정량: 위원이 0 ~ 배점 사이 점수를 직접 입력합니다.</li>
          <li>· 정성: 위원이 등급(답)을 선택하면 해당 등급의 환산점수가 부여됩니다.</li>
          <li>· 최종 점수 = Σ(항목 점수 × 가중치)의 위원 평균입니다.</li>
        </ul>
      </div>

      {/* 항목 추가 */}
      {locked ? (
        <p className="text-sm text-slate-400">마감된 회차는 항목을 수정할 수 없습니다.</p>
      ) : (
        <div className="max-w-2xl">
          <AddCriterionForm sessionId={id} sections={sectionNames} />
        </div>
      )}
    </div>
  )
}
