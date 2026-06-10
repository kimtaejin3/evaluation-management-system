'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

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
