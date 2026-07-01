'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { assertMaster } from '@/lib/authz'

export async function createProject(formData: FormData) {
  await assertMaster()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const p = await prisma.project.create({
    data: {
      name,
      description: String(formData.get('description') ?? '') || null,
      dueDate: formData.get('dueDate') ? new Date(String(formData.get('dueDate'))) : null,
    },
  })
  redirect(`/admin/projects/${p.id}`)
}

export async function assignSecretaryToProject(projectId: string, formData: FormData) {
  await assertMaster()
  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { connect: { id: userId } } } })
  revalidatePath(`/admin/projects/${projectId}`)
}

export async function removeSecretaryFromProject(projectId: string, userId: string) {
  await assertMaster()
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { disconnect: { id: userId } } } })
  revalidatePath(`/admin/projects/${projectId}`)
}

// 과제 삭제 — 소속 분과의 projectId는 SetNull(미분류로 남음)
export async function deleteProject(projectId: string) {
  await assertMaster()
  await prisma.project.delete({ where: { id: projectId } })
  redirect('/admin/projects')
}
