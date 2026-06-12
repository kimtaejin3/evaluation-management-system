import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { put, del } from '@vercel/blob'

export const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads')

// Blob 토큰이 있으면 Vercel Blob, 없으면(로컬 개발) 디스크에 저장
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN

export interface StoredFile {
  storedName: string
  url: string | null
}

export async function saveUpload(file: File): Promise<StoredFile> {
  const ext = path.extname(file.name)
  const storedName = `${randomUUID()}${ext}`
  if (useBlob) {
    const blob = await put(`documents/${storedName}`, file, { access: 'public', addRandomSuffix: false })
    return { storedName, url: blob.url }
  }
  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()))
  return { storedName, url: null }
}

export async function deleteUpload(storedName: string, url: string | null): Promise<void> {
  try {
    if (url) {
      await del(url)
    } else {
      await unlink(path.join(UPLOAD_DIR, storedName))
    }
  } catch {
    // 이미 없거나 실패해도 무시(DB 정리는 진행)
  }
}
