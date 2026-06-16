import { readFile } from 'fs/promises'
import path from 'path'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { UPLOAD_DIR } from '@/lib/storage'
import BackButton from '@/components/BackButton'
import HwpViewer from '@/components/HwpViewer'
import PdfViewer from '@/components/PdfViewer'

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

// mimeType이 불명확(application/octet-stream 등)해도 확장자로 형식 보강
type Kind = 'image' | 'pdf' | 'text' | 'hwp' | 'unsupported'
function detectKind(mime: string, name: string): Kind {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (/^image\//i.test(mime) || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (/pdf/i.test(mime) || ext === 'pdf') return 'pdf'
  if (ext === 'hwp') return 'hwp'
  if (/^text\//i.test(mime) || /(json|xml|csv)/i.test(mime) || ['txt', 'csv', 'json', 'xml', 'md', 'log'].includes(ext))
    return 'text'
  return 'unsupported'
}

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ embed?: string }>
}) {
  const { id } = await params
  const { embed } = await searchParams
  const isEmbed = embed === '1'
  const user = await getCurrentUser()
  if (!user) return null
  const doc = await prisma.document.findUnique({ where: { id }, include: { company: { select: { name: true } } } })
  if (!doc) notFound()

  const src = `/api/documents/${doc.id}`
  const kind = detectKind(doc.mimeType, doc.originalName)
  const textContent = kind === 'text' ? await readText(doc) : null

  const body = (
    <>
      {kind === 'image' && (
        <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={doc.originalName} className="max-h-[85vh] w-auto object-contain" />
        </div>
      )}
      {kind === 'pdf' && <PdfViewer id={doc.id} embed={isEmbed} />}
      {kind === 'text' &&
        (textContent !== null ? (
          <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800">{textContent}</pre>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">파일을 불러올 수 없습니다.</div>
        ))}
      {kind === 'hwp' && <HwpViewer id={doc.id} name={doc.originalName} />}
      {kind === 'unsupported' && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">이 형식({doc.mimeType || '알 수 없음'})은 미리보기를 지원하지 않습니다.</p>
          <p className="mt-2 text-xs text-slate-400">PDF·이미지·텍스트·한글(.hwp) 형식이 화면 열람을 지원합니다.</p>
        </div>
      )}
    </>
  )

  // 프리뷰 보드(평가위원 화면) 등에서 iframe으로 임베드할 때는 헤더 없이 본문만
  if (isEmbed) {
    return <div className="min-h-screen w-full bg-slate-100 p-2">{body}</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
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
          <a href={src} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50">새 탭에서 보기</a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">{body}</main>
    </div>
  )
}
