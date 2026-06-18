import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { getUploadBytes } from '@/lib/storage'

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  log: 'text/plain; charset=utf-8',
}

// mimeType이 비었거나 octet-stream이면 확장자로 보강. 텍스트류는 charset=utf-8(한글 깨짐 방지)
function contentType(mime: string, name: string): string {
  const generic = !mime || /octet-stream/i.test(mime)
  if (generic) {
    const ext = name.toLowerCase().split('.').pop() ?? ''
    if (EXT_MIME[ext]) return EXT_MIME[ext]
    return mime || 'application/octet-stream'
  }
  if (/^text\//i.test(mime) || /(json|xml|csv|javascript)/i.test(mime)) {
    return /charset/i.test(mime) ? mime : `${mime}; charset=utf-8`
  }
  return mime
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return new Response('Not found', { status: 404 })

  // 다운로드 기능 없음 — 항상 브라우저 내 인라인 미리보기로만 제공
  const headers = {
    'Content-Type': contentType(doc.mimeType, doc.originalName),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
  }

  // 저장소(R2/Blob/로컬) 무관 — 서버가 인증 통과 후 받아서 인라인 제공(URL 미노출)
  const bytes = await getUploadBytes(doc)
  if (!bytes) return new Response('File missing', { status: 404 })
  // 런타임은 Uint8Array를 그대로 받지만 TS DOM 타입(BodyInit) 마찰이 있어 캐스팅
  return new Response(bytes as unknown as BodyInit, { headers })
}
