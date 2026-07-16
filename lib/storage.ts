import { mkdir, writeFile, unlink, readFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { put, del } from '@vercel/blob'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

// 브라우저 → R2 직접 업로드(대용량) 지원 여부
export function r2Enabled(): boolean {
  return useR2
}

// 브라우저가 R2로 바로 PUT할 수 있는 presigned URL 발급(10분 유효).
// storedName은 서버에서 생성해 임의 키 업로드를 방지한다.
export async function presignR2Upload(
  fileName: string,
  contentType: string,
): Promise<{ uploadUrl: string; storedName: string; url: string }> {
  const ext = path.extname(fileName).toLowerCase() || '.pdf'
  const storedName = `${randomUUID()}${ext}`
  const key = `documents/${storedName}`
  const uploadUrl = await getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 600 },
  )
  return { uploadUrl, storedName, url: `${R2_PREFIX}${key}` }
}

// 직접 업로드 완료 확인 — 객체 존재 여부와 실제 크기를 R2에서 조회(클라이언트 신고값을 신뢰하지 않음)
export async function headR2Upload(url: string): Promise<number | null> {
  if (!url.startsWith(R2_PREFIX)) return null
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: url.slice(R2_PREFIX.length) }))
    return res.ContentLength ?? 0
  } catch {
    return null
  }
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
