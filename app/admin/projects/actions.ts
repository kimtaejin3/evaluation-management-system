'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { assertMaster } from '@/lib/authz'
import { hashPassword } from '@/lib/auth'

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

// 간사 계정 인라인 생성 + 이 과제에 바로 배정
export async function createSecretaryForProject(projectId: string, formData: FormData) {
  await assertMaster()
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const phone = String(formData.get('phone') ?? '').trim() || null
  if (!username || !name || !password) return
  const user = await prisma.user.upsert({
    where: { username },
    update: { name, phone: phone ?? undefined, role: 'SECRETARY' },
    create: { username, name, phone, role: 'SECRETARY', passwordHash: await hashPassword(password), tempPassword: password },
  })
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { connect: { id: user.id } } } })
  revalidatePath(`/admin/projects/${projectId}`)
}

// 분과별 담당 간사 지정/해제 (마스터). userId 비면 미지정.
export async function setSessionSecretary(projectId: string, sessionId: string, formData: FormData) {
  await assertMaster()
  const userId = String(formData.get('userId') ?? '').trim() || null
  // 분과가 이 과제 소속인지 확인
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  if (!session || session.projectId !== projectId) return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { secretaryId: userId } })
  revalidatePath(`/admin/projects/${projectId}`)
}

// 과제 삭제 — 소속 분과의 projectId는 SetNull(미분류로 남음)
export async function deleteProject(projectId: string) {
  await assertMaster()
  await prisma.project.delete({ where: { id: projectId } })
  redirect('/admin/projects')
}
