'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

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
