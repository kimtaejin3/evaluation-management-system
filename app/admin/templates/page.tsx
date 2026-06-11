import { prisma } from '@/lib/db'
import { deleteTemplate } from '../actions'

export default async function TemplatesPage() {
  const templates = await prisma.criterionTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { order: 'asc' } } },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">항목 템플릿</h1>
        <p className="mt-1 text-sm text-slate-500">자주 쓰는 평가 항목 묶음입니다. 회차의 평가 항목 화면에서 저장·불러오기 할 수 있습니다.</p>
      </div>

      {templates.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          저장된 템플릿이 없습니다. 회차의 「평가 항목」 화면에서 현재 항목을 템플릿으로 저장해 보세요.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => {
          const total = t.items.reduce((s, it) => s + it.maxScore, 0)
          return (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-800">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.items.length}개 항목 · 총 배점 {total}</div>
                </div>
                <form action={async () => { 'use server'; await deleteTemplate(t.id) }}>
                  <button className="text-sm text-rose-600 hover:underline">삭제</button>
                </form>
              </div>
              <ul className="divide-y divide-slate-50">
                {t.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${it.type === 'QUALITATIVE' ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {it.type === 'QUALITATIVE' ? '정성' : '정량'}
                      </span>
                      <span className="text-slate-700">{it.name}</span>
                    </span>
                    <span className="text-slate-500">배점 {it.maxScore} · 가중치 {it.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
