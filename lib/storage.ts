import { mkdir, writeFile, unlink, readFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { put, del } from '@vercel/blob'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads')

// 저장 우선순위: Cloudflare R2 → Vercel Blob → 로컬 디스크(개발)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET = process.env.R2_BUCKET
const useR2 = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET)
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN

// R2 객체 키는 url 필드에 `r2:` 접두사로 저장해 다른 저장소와 구분(기존 Blob URL/로컬은 그대로 동작)
const R2_PREFIX = 'r2:'

let _s3: S3Client | null = null
function r2(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
    })
  }
  return _s3
}

export interface StoredFile {
  storedName: string
  url: string | null
}

// 업로드 허용 형식: PDF만. 확장자(.pdf) 또는 MIME(application/pdf)로 판별.
export function isPdf(file: File): boolean {
  const ext = path.extname(file.name).toLowerCase()
  return ext === '.pdf' || file.type === 'application/pdf'
}

export async function saveUpload(file: File): Promise<StoredFile> {
  const ext = path.extname(file.name)
  const storedName = `${randomUUID()}${ext}`
  if (useR2) {
    const key = `documents/${storedName}`
    const body = Buffer.from(await file.arrayBuffer())
    await r2().send(
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: file.type || 'application/octet-stream' }),
    )
    return { storedName, url: `${R2_PREFIX}${key}` }
  }
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
    if (url?.startsWith(R2_PREFIX)) {
      await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: url.slice(R2_PREFIX.length) }))
    } else if (url) {
      await del(url)
    } else {
      await unlink(path.join(UPLOAD_DIR, storedName))
    }
  } catch {
    // 이미 없거나 실패해도 무시(DB 정리는 진행)
  }
}

// 저장소 무관 읽기 — R2(GetObject) / Blob(fetch) / 로컬(readFile) 모두 처리
export async function getUploadBytes(doc: { storedName: string; url: string | null }): Promise<Uint8Array | null> {
  try {
    if (doc.url?.startsWith(R2_PREFIX)) {
      const res = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: doc.url.slice(R2_PREFIX.length) }))
      return res.Body ? await res.Body.transformToByteArray() : null
    }
    if (doc.url) {
      const r = await fetch(doc.url)
      if (!r.ok) return null
      return new Uint8Array(await r.arrayBuffer())
    }
    return new Uint8Array(await readFile(path.join(UPLOAD_DIR, doc.storedName)))
  } catch {
    return null
  }
}
