import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { setSessionStatus } from '../actions'

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

  const meta: { label: string; value: string }[] = [
    { label: '일시', value: session.eventDate ? new Date(session.eventDate).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
    { label: '장소', value: session.location || '—' },
    { label: '평가 항목', value: `${session._count.criteria}개` },
    { label: '평가 대상', value: `${session._count.subjects}개` },
    { label: '평가위원', value: `${session._count.assignments}명` },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="mb-4 font-semibold">회차 정보</h2>
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
            <button disabled={session.status !== 'IN_PROGRESS'} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
              마감·잠금
            </button>
          </form>
          <form action={async () => { 'use server'; await setSessionStatus(id, 'DRAFT') }}>
            <button disabled={session.status === 'DRAFT'} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
              초안으로 되돌리기
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
