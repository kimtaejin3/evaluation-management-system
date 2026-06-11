import { readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/db'
import { getCurrentToken } from '@/lib/session'
import { UPLOAD_DIR } from '@/lib/storage'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return new Response('Not found', { status: 404 })

  try {
    const data = await readFile(path.join(UPLOAD_DIR, doc.storedName))
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      },
    })
  } catch {
    return new Response('File missing', { status: 404 })
  }
}
