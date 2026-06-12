import { readFile } from 'fs/promises'
import path from 'path'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { UPLOAD_DIR } from '@/lib/storage'
import BackButton from '@/components/BackButton'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function readText(doc: { url: string | null; storedName: string }): Promise<string | null> {
  try {
    if (doc.url) return await (await fetch(doc.url)).text()
    return (await readFile(path.join(UPLOAD_DIR, doc.storedName))).toString('utf8')
  } catch {
    return null
  }
}

export default async function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return null
  const doc = await prisma.document.findUnique({ where: { id }, include: { company: { select: { name: true } } } })
  if (!doc) notFound()

  const src = `/api/documents/${doc.id}`
  const mime = doc.mimeType
  const isImage = /^image\//i.test(mime)
  const isPdf = /pdf/i.test(mime)
  const isText = /^text\//i.test(mime) || /(json|xml|csv)/i.test(mime)
  const textContent = isText ? await readText(doc) : null

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* 상단 바 */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50">
            ← 닫기
          </BackButton>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">{doc.originalName}</div>
            <div className="text-xs text-slate-400">{doc.company.name} · {formatSize(doc.size)}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href={src} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50">새 탭</a>
          <a href={`${src}?download=1`} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700">다운로드</a>
        </div>
      </header>

      {/* 본문 */}
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
        {isImage && (
          <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={doc.originalName} className="max-h-[80vh] w-auto object-contain" />
          </div>
        )}
        {isPdf && (
          <iframe src={src} title={doc.originalName} className="h-[82vh] w-full rounded-lg border border-slate-200 bg-white" />
        )}
        {isText && (
          textContent !== null ? (
            <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800">{textContent}</pre>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">파일을 불러올 수 없습니다.</div>
          )
        )}
        {!isImage && !isPdf && !isText && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm text-slate-500">이 형식({mime || '알 수 없음'})은 미리보기를 지원하지 않습니다.</p>
            <a href={`${src}?download=1`} className="mt-3 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">다운로드</a>
          </div>
        )}
      </main>
    </div>
  )
}
