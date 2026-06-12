import Link from 'next/link'
import { prisma } from '@/lib/db'
import CompanyLogo from '@/components/CompanyLogo'
import { addSubject, deleteSubject } from '../../actions'

const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function SubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const subjects = await prisma.subject.findMany({
    where: { sessionId: id },
    orderBy: { order: 'asc' },
    // 이 회차 전용 자료 + 공통(sessionId=null) 자료만
    include: {
      company: {
        include: {
          documents: { where: { OR: [{ sessionId: id }, { sessionId: null }] }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  const usedCompanyIds = subjects.map((s) => s.companyId)
  const available = await prisma.company.findMany({
    where: { id: { notIn: usedCompanyIds.length ? usedCompanyIds : [''] } },
    orderBy: { name: 'asc' },
  })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      {/* 대상 추가 (상단) */}
      {locked ? (
        <p className="text-sm text-slate-400">마감된 회차는 평가 대상을 수정할 수 없습니다.</p>
      ) : (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 text-sm font-semibold text-slate-700">평가 대상 추가</div>
          {/* 기존 기업에서 선택 */}
          <form action={addSubject.bind(null, id)} className="flex gap-2">
            <select name="companyId" defaultValue="" required className={`flex-1 ${inputCls}`}>
              <option value="" disabled>기존 기업 선택</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={available.length === 0} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
              추가
            </button>
          </form>
          {/* 신규 기업 등록 후 추가 */}
          <form action={addSubject.bind(null, id)} className="flex gap-2">
            <input name="newName" placeholder="신규 기업명 입력" className={`flex-1 ${inputCls}`} />
            <button className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
              등록·추가
            </button>
          </form>
          <p className="sm:col-span-2 text-xs text-slate-400">
            기업·자료는 <Link href="/admin/companies" className="text-indigo-600 hover:underline">기업 관리</Link>에서 전역으로 관리되며 회차 간 공유됩니다.
          </p>
        </div>
      )}

      {/* 대상 탭(빠른 이동) */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s, i) => (
            <a
              key={s.id}
              href={`#subject-${s.id}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <span className="mr-1 text-slate-400">{i + 1}</span>
              {s.name}
            </a>
          ))}
        </div>
      )}

      {subjects.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          편입된 평가 대상이 없습니다. 위에서 기업을 추가하세요.
        </div>
      )}

      <div className="space-y-4">
        {subjects.map((s, i) => (
          <div key={s.id} id={`subject-${s.id}`} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CompanyLogo name={s.name} className="h-9 w-9 text-sm" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">{i + 1}</span>
                    <span className="font-semibold text-slate-800">{s.name}</span>
                  </div>
                  {s.company.description && <p className="mt-1 text-sm text-slate-500">{s.company.description}</p>}
                </div>
              </div>
              {!locked && (
                <form action={async () => { 'use server'; await deleteSubject(id, s.id) }}>
                  <button className="text-sm text-rose-600 hover:underline">회차에서 제외</button>
                </form>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">심사 서류 ({s.company.documents.length})</span>
                <Link href="/admin/companies" className="text-xs text-indigo-600 hover:underline">기업 관리에서 자료 추가/수정 →</Link>
              </div>
              <ul className="space-y-1">
                {s.company.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
                      <span>📄</span>
                      <span>{d.originalName}</span>
                      <span className="text-xs text-slate-400">{formatSize(d.size)}</span>
                    </a>
                  </li>
                ))}
                {s.company.documents.length === 0 && <li className="text-sm text-slate-400">등록된 자료가 없습니다. (기업 관리에서 업로드)</li>}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
