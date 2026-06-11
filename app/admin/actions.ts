'use server'

import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { UPLOAD_DIR } from '@/lib/storage'

// ---- 평가위원 관리(전역) ----

export async function createEvaluator(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!username || !name || !password) return

  await prisma.user.upsert({
    where: { username },
    update: { name },
    create: { username, name, role: 'EVALUATOR', passwordHash: await hashPassword(password) },
  })
  revalidatePath('/admin/evaluators')
}

export async function deleteEvaluator(userId: string) {
  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/admin/evaluators')
}

// ---- 기업(평가 대상 원본) 관리(전역) ----

export async function createCompany(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await prisma.company.upsert({
    where: { name },
    update: { description: String(formData.get('description') ?? '') || undefined },
    create: { name, description: String(formData.get('description') ?? '') || null },
  })
  revalidatePath('/admin/companies')
}

export async function deleteCompany(companyId: string) {
  await prisma.company.delete({ where: { id: companyId } })
  revalidatePath('/admin/companies')
}

export async function uploadCompanyDocument(companyId: string, formData: FormData) {
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return

  await mkdir(UPLOAD_DIR, { recursive: true })
  for (const file of files) {
    const storedName = randomUUID() + path.extname(file.name)
    await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()))
    await prisma.document.create({
      data: {
        companyId,
        originalName: file.name,
        storedName,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
    })
  }
  revalidatePath('/admin/companies')
}

export async function deleteCompanyDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return
  await prisma.document.delete({ where: { id: documentId } })
  try {
    await unlink(path.join(UPLOAD_DIR, doc.storedName))
  } catch {
    // 파일이 이미 없으면 무시
  }
  revalidatePath('/admin/companies')
}
