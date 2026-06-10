import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { setSessionStatus } from '../actions'

const STATUS_LABEL = { DRAFT: '초안', IN_PROGRESS: '진행중', CLOSED: '마감' } as const

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({
    where: { id },
    include: { _count: { select: { criteria: true, subjects: true, assignments: true } } },
  })
  if (!session) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <p className="text-sm text-gray-500">상태: {STATUS_LABEL[session.status]}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href={`/admin/sessions/${id}/criteria`} className="rounded border p-4 hover:bg-gray-50">평가 항목 ({session._count.criteria})</Link>
        <Link href={`/admin/sessions/${id}/subjects`} className="rounded border p-4 hover:bg-gray-50">평가 대상 ({session._count.subjects})</Link>
        <Link href={`/admin/sessions/${id}/evaluators`} className="rounded border p-4 hover:bg-gray-50">평가위원 ({session._count.assignments})</Link>
        <Link href={`/admin/sessions/${id}/results`} className="rounded border p-4 hover:bg-gray-50">집계 결과</Link>
      </div>

      <div className="flex gap-2">
        <form action={async () => { 'use server'; await setSessionStatus(id, 'IN_PROGRESS') }}>
          <button disabled={session.status !== 'DRAFT'} className="rounded border px-4 py-2 disabled:opacity-40">평가 시작</button>
        </form>
        <form action={async () => { 'use server'; await setSessionStatus(id, 'CLOSED') }}>
          <button disabled={session.status !== 'IN_PROGRESS'} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40">마감·잠금</button>
        </form>
        <form action={async () => { 'use server'; await setSessionStatus(id, 'DRAFT') }}>
          <button disabled={session.status === 'DRAFT'} className="rounded border px-4 py-2 disabled:opacity-40">초안으로</button>
        </form>
      </div>
    </div>
  )
}
