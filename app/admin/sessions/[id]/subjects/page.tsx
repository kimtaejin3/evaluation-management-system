import { prisma } from '@/lib/db'
import { addSubject, deleteSubject, uploadDocument, deleteDocument } from '../../actions'

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
    include: { documents: { orderBy: { createdAt: 'asc' } } },
  })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      {subjects.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          등록된 대상이 없습니다.
        </div>
      )}

      <div className="space-y-4">
        {subjects.map((s, i) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{i + 1}</span>
                  <span className="font-semibold text-slate-800">{s.name}</span>
                </div>
                {s.description && <p className="mt-1 text-sm text-slate-500">{s.description}</p>}
              </div>
              {!locked && (
                <form action={async () => { 'use server'; await deleteSubject(id, s.id) }}>
                  <button className="text-sm text-rose-600 hover:underline">대상 삭제</button>
                </form>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-medium text-slate-500">심사 서류 ({s.documents.length})</div>
              <ul className="space-y-1">
                {s.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
                      <span>📄</span>
                      <span>{d.originalName}</span>
                      <span className="text-xs text-slate-400">{formatSize(d.size)}</span>
                    </a>
                    {!locked && (
                      <form action={async () => { 'use server'; await deleteDocument(id, d.id) }}>
                        <button className="text-xs text-rose-500 hover:underline">삭제</button>
                      </form>
                    )}
                  </li>
                ))}
                {s.documents.length === 0 && <li className="text-sm text-slate-400">업로드된 서류가 없습니다.</li>}
              </ul>
              {!locked && (
                <form action={uploadDocument.bind(null, id, s.id)} className="mt-3 flex items-center gap-2">
                  <input type="file" name="file" required className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200" />
                  <button className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white transition hover:bg-slate-900">업로드</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      {locked ? (
        <p className="text-sm text-slate-400">마감된 회차는 대상·서류를 수정할 수 없습니다.</p>
      ) : (
        <form action={addSubject.bind(null, id)} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="col-span-2 text-sm font-semibold text-slate-700">새 대상 추가</div>
          <input name="name" placeholder="대상명" required className={inputCls} />
          <input name="description" placeholder="설명(선택)" className={inputCls} />
          <button className="col-span-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
            + 대상 추가
          </button>
        </form>
      )}
    </div>
  )
}
