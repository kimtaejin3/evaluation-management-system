import Link from 'next/link'
import { prisma } from '@/lib/db'
import { demoLoginAs } from './actions'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, { text: string; cls: string }> = {
  DRAFT: { text: '준비중', cls: 'bg-slate-100 text-slate-500' },
  IN_PROGRESS: { text: '진행중', cls: 'bg-emerald-50 text-emerald-700' },
  CLOSED: { text: '마감', cls: 'bg-slate-100 text-slate-500' },
}

// ⚠️ 데모/프로토타입 전용 화면 — 사업 > 분과를 골라 그 분과의 평가위원·위원장으로 즉시 로그인.
// 정식 배포 전 제거 예정.
export default async function DemoLoginPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      sessions: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          status: true,
          chairId: true,
          // 프로토타입 — 배정 상태(APPROVED/PENDING)와 무관하게 위원을 모두 노출해 고를 수 있게 한다.
          assignments: {
            where: { user: { role: 'EVALUATOR' } },
            select: { user: { select: { id: true, name: true, username: true } } },
          },
        },
      },
    },
  })

  // 배정 위원이 한 명이라도 있는 분과만 노출
  const rows = projects
    .map((p) => ({
      ...p,
      sessions: p.sessions.filter((s) => s.assignments.length > 0),
    }))
    .filter((p) => p.sessions.length > 0)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          ⚠ 데모 전용 · 프로토타입 (정식 배포 전 제거)
        </div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">분과별 평가위원 로그인</h1>
        <p className="mt-1 text-sm text-slate-500">
          어떤 사업 &gt; 분과의 위원으로 볼지 선택하세요. 버튼을 누르면 그 분과를 진행중·승인 상태로 만들고 비밀번호 없이 그 위원으로 로그인합니다.
        </p>
        <Link href="/login" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
          ← 일반 로그인으로
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          배정된 평가위원이 있는 분과가 없습니다. 관리자 화면에서 위원을 배정하세요.
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((p) => (
            <section key={p.id} className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">{p.name}</h2>
              <div className="space-y-3">
                {p.sessions.map((s) => {
                  const st = statusLabel[s.status] ?? statusLabel.DRAFT
                  return (
                    <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="font-medium text-slate-800">{s.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.text}</span>
                        {s.status !== 'IN_PROGRESS' && (
                          <span className="text-xs text-slate-400">· 로그인 시 진행중으로 전환됨</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {s.assignments.map((a) => {
                          const isChair = a.user.id === s.chairId
                          return (
                            <form key={a.user.id} action={demoLoginAs.bind(null, s.id, a.user.id)}>
                              <button
                                type="submit"
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                  isChair
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {a.user.name}
                                {isChair && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">위원장</span>}
                                <span className="text-xs text-slate-400">{a.user.username}</span>
                              </button>
                            </form>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
