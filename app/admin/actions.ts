'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { saveUpload, deleteUpload, isPdf } from '@/lib/storage'
import { requireAdminUser } from '@/lib/authz'

// ---- 평가위원·간사 계정 관리(전역) ----

export async function createEvaluator(formData: FormData) {
  const actor = await requireAdminUser()
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const phone = String(formData.get('phone') ?? '').trim() || null
  // 역할: 간사(SECRETARY) 생성은 마스터만. 그 외/간사 아닌 요청은 평가위원.
  let role: 'SECRETARY' | 'EVALUATOR' =
    String(formData.get('role') ?? 'EVALUATOR') === 'SECRETARY' ? 'SECRETARY' : 'EVALUATOR'
  if (role === 'SECRETARY' && actor.role !== 'MASTER') role = 'EVALUATOR'
  if (!username || !name || !password) return

  await prisma.user.upsert({
    where: { username },
    update: { name, phone: phone ?? undefined, role },
    create: { username, name, phone, role, passwordHash: await hashPassword(password), tempPassword: password },
  })
  revalidatePath('/admin/evaluators')
}

export async function deleteEvaluator(userId: string) {
  await requireAdminUser()
  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/admin/evaluators')
}

// 임시 비밀번호 재발급 — 새 임시 비번 생성·저장
export async function resetEvaluatorPassword(userId: string) {
  await requireAdminUser()
  const newPw = randomUUID().replace(/-/g, '').slice(0, 8)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPw), tempPassword: newPw },
  })
  revalidatePath('/admin/evaluators')
}

// ---- 기업(평가 대상 원본) 관리(전역) ----

export async function createCompany(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const businessNo = String(formData.get('businessNo') ?? '').trim() || null
  await prisma.company.upsert({
    where: { name },
    update: {
      description: String(formData.get('description') ?? '') || undefined,
      businessNo: businessNo ?? undefined,
    },
    create: { name, businessNo, description: String(formData.get('description') ?? '') || null },
  })
  revalidatePath('/admin/companies')
}

export async function deleteCompany(companyId: string) {
  await prisma.company.delete({ where: { id: companyId } })
  revalidatePath('/admin/companies')
}

// sessionId: 특정 심사용 자료면 심사 id, 비우면(공통) null
export async function uploadCompanyDocument(companyId: string, formData: FormData) {
  // PDF만 허용
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0 && isPdf(f))
  if (files.length === 0) return
  const sessionId = String(formData.get('sessionId') ?? '').trim() || null

  for (const file of files) {
    const { storedName, url } = await saveUpload(file)
    await prisma.document.create({
      data: {
        companyId,
        sessionId,
        originalName: file.name,
        storedName,
        url,
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
  await deleteUpload(doc.storedName, doc.url)
  revalidatePath('/admin/companies')
}
