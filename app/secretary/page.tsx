import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

// 간사 콘솔 진입 → 진행중 우선, 없으면 최신 심사로 이동
export default async function SecretaryHome() {
  const sessions = await prisma.evaluationSession.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  })
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
        등록된 심사가 없습니다.
      </div>
    )
  }
  const target = sessions.find((s) => s.status === 'IN_PROGRESS') ?? sessions[0]
  redirect(`/secretary/${target.id}`)
}
