'use server'

import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { UPLOAD_DIR } from '@/lib/storage'

export async function createSession(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const session = await prisma.evaluationSession.create({
    data: {
      name,
      description: String(formData.get('description') ?? '') || null,
      location: String(formData.get('location') ?? '') || null,
      eventDate: formData.get('eventDate') ? new Date(String(formData.get('eventDate'))) : null,
    },
  })
  redirect(`/admin/sessions/${session.id}`)
}

export async function setSessionStatus(sessionId: string, status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED') {
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { status } })
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function addCriterion(sessionId: string, formData: FormData) {
  const count = await prisma.criterion.count({ where: { sessionId } })
  await prisma.criterion.create({
    data: {
      sessionId,
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '') || null,
      type: String(formData.get('type')) === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE',
      maxScore: Number(formData.get('maxScore') ?? 0),
      weight: Number(formData.get('weight') ?? 1),
      order: count,
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

export async function deleteCriterion(sessionId: string, criterionId: string) {
  await prisma.criterion.delete({ where: { id: criterionId } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

export async function addSubject(sessionId: string, formData: FormData) {
  const count = await prisma.subject.count({ where: { sessionId } })
  await prisma.subject.create({
    data: {
      sessionId,
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '') || null,
      order: count,
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function deleteSubject(sessionId: string, subjectId: string) {
  await prisma.subject.delete({ where: { id: subjectId } })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function addEvaluator(sessionId: string, formData: FormData) {
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!username || !name || !password) return

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, name, role: 'EVALUATOR', passwordHash: await hashPassword(password) },
  })
  await prisma.assignment.upsert({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    update: {},
    create: { sessionId, userId: user.id },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

export async function removeEvaluator(sessionId: string, userId: string) {
  await prisma.assignment.delete({ where: { sessionId_userId: { sessionId, userId } } })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

// ---- 평가 대상 서류 ----

export async function uploadDocument(sessionId: string, subjectId: string, formData: FormData) {
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return

  await mkdir(UPLOAD_DIR, { recursive: true })
  for (const file of files) {
    const ext = path.extname(file.name)
    const storedName = randomUUID() + ext
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(UPLOAD_DIR, storedName), bytes)

    await prisma.document.create({
      data: {
        subjectId,
        originalName: file.name,
        storedName,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
    })
  }
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function deleteDocument(sessionId: string, documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return
  await prisma.document.delete({ where: { id: documentId } })
  try {
    await unlink(path.join(UPLOAD_DIR, doc.storedName))
  } catch {
    // 파일이 이미 없으면 무시
  }
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

// ---- 항목 템플릿 ----

export async function saveCriteriaTemplate(sessionId: string, formData: FormData) {
  const name = String(formData.get('templateName') ?? '').trim()
  if (!name) return
  const criteria = await prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
  if (criteria.length === 0) return

  await prisma.criterionTemplate.create({
    data: {
      name,
      items: {
        create: criteria.map((c) => ({
          name: c.name,
          description: c.description,
          type: c.type,
          maxScore: c.maxScore,
          weight: c.weight,
          order: c.order,
        })),
      },
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

export async function applyCriteriaTemplate(sessionId: string, formData: FormData) {
  const templateId = String(formData.get('templateId') ?? '')
  if (!templateId) return
  const template = await prisma.criterionTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { order: 'asc' } } },
  })
  if (!template) return

  const existing = await prisma.criterion.count({ where: { sessionId } })
  await prisma.criterion.createMany({
    data: template.items.map((it, i) => ({
      sessionId,
      name: it.name,
      description: it.description,
      type: it.type,
      maxScore: it.maxScore,
      weight: it.weight,
      order: existing + i,
    })),
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

export async function deleteCriteriaTemplate(sessionId: string, templateId: string) {
  await prisma.criterionTemplate.delete({ where: { id: templateId } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

// ---- 회차 복사 ----

export async function duplicateSession(sessionId: string) {
  const src = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    include: { criteria: true, subjects: true },
  })
  if (!src) return

  const copy = await prisma.evaluationSession.create({
    data: {
      name: `${src.name} (복사본)`,
      description: src.description,
      location: src.location,
      eventDate: src.eventDate,
      status: 'DRAFT',
      criteria: {
        create: src.criteria.map((c) => ({
          name: c.name,
          description: c.description,
          type: c.type,
          maxScore: c.maxScore,
          weight: c.weight,
          order: c.order,
        })),
      },
      subjects: {
        create: src.subjects.map((s) => ({
          name: s.name,
          description: s.description,
          order: s.order,
        })),
      },
    },
  })
  redirect(`/admin/sessions/${copy.id}`)
}
