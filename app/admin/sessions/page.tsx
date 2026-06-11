import Link from 'next/link'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import StatusBadge from '@/components/StatusBadge'

const STATUS_OPTIONS = [
  { value: '', label: '상태 전체' },
  { value: 'DRAFT', label: '초안' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'CLOSED', label: '마감' },
]

export default async function SessionListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const where: Prisma.EvaluationSessionWhereInput = {}
  if (q) where.name = { contains: q, mode: 'insensitive' }
  if (status === 'DRAFT' || status === 'IN_PROGRESS' || status === 'CLOSED') where.status = status

  const sessions = await prisma.evaluationSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { subjects: true, criteria: true, assignments: true } } },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">회차 관리</h1>
          <p className="mt-1 text-sm text-slate-500">심사 회차 생성 · 편집 · 마감</p>
        </div>
        <Link href="/admin/sessions/new" className="rounded-md bg-[var(--gov-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95">
          + 새 회차
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="회차명 검색"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[var(--gov-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gov-primary)]"
        />
        <select name="status" defaultValue={status ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">검색</button>
      </form>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-5 py-3 font-semibold">회차명</th>
              <th className="px-5 py-3 font-semibold">상태</th>
              <th className="px-5 py-3 font-semibold">항목</th>
              <th className="px-5 py-3 font-semibold">대상</th>
              <th className="px-5 py-3 font-semibold">위원</th>
              <th className="px-5 py-3 font-semibold">일시</th>
              <th className="px-5 py-3 font-semibold">동작</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">
                  {s.name}
                  {s.location && <div className="text-xs text-slate-400">{s.location}</div>}
                </td>
                <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-5 py-3 text-slate-600">{s._count.criteria}</td>
                <td className="px-5 py-3 text-slate-600">{s._count.subjects}</td>
                <td className="px-5 py-3 text-slate-600">{s._count.assignments}</td>
                <td className="px-5 py-3 text-slate-500">
                  {s.eventDate ? new Date(s.eventDate).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </td>
                <td className="px-5 py-3">
                  <Link href={`/admin/sessions/${s.id}`} className="text-[var(--gov-primary)] hover:underline">관리</Link>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">조회된 회차가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
