import { readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { UPLOAD_DIR } from '@/lib/storage'

// text/* 등 텍스트 계열은 charset 미지정 시 한글이 깨지므로 UTF-8 명시
function contentType(mime: string): string {
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
    'Content-Type': contentType(doc.mimeType),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
  }

  // Vercel Blob: 인증 통과 후 서버가 받아 스트리밍(URL 노출 없이 권한 유지)
  if (doc.url) {
    try {
      const r = await fetch(doc.url)
      if (!r.ok || !r.body) return new Response('File missing', { status: 404 })
      return new Response(r.body, { headers })
    } catch {
      return new Response('File missing', { status: 404 })
    }
  }

  // 로컬 디스크
  try {
    const data = await readFile(path.join(UPLOAD_DIR, doc.storedName))
    return new Response(new Uint8Array(data), { headers })
  } catch {
    return new Response('File missing', { status: 404 })
  }
}
