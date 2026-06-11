'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

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
