'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { assertMaster } from '@/lib/authz'
import { hashPassword } from '@/lib/auth'
import { passwordFromPhone } from '@/lib/phone'

export async function createProject(formData: FormData) {
  await assertMaster()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const dueRaw = String(formData.get('dueDate') ?? '').trim()
  const taskType = String(formData.get('taskType') ?? '').trim()
  // 과제명·과제 개요·과제유형·평가일 모두 필수
  if (!name || !description || !taskType || !dueRaw) return
  const p = await prisma.project.create({
    data: {
      name,
      description,
      // 인쇄 평가표 헤더용 과제유형
      taskType,
      dueDate: new Date(dueRaw),
    },
  })
  redirect(`/admin/projects/${p.id}`)
}

// 과제 과제유형 수정(마스터) — 인쇄 헤더용
export async function updateProjectTaskType(projectId: string, formData: FormData) {
  await assertMaster()
  await prisma.project.update({
    where: { id: projectId },
    data: { taskType: String(formData.get('taskType') ?? '').trim() || null },
  })
  revalidatePath(`/admin/projects/${projectId}`)
}

// "배정" = 간사(기존 선택)를 분과에 배정. 과제 접근 권한도 함께 부여(project.secretaries).
export async function assignSecretaryToSession(projectId: string, formData: FormData) {
  await assertMaster()
  const sessionId = String(formData.get('sessionId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  if (!sessionId || !userId) return
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  if (!session || session.projectId !== projectId) return
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { connect: { id: userId } } } })
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { secretaryId: userId } })
  revalidatePath(`/admin/projects/${projectId}`)
}

// "배정" = 간사 계정을 새로 만들고 곧바로 분과에 배정(+과제 접근 부여).
export async function createSecretaryAndAssignToSession(projectId: string, formData: FormData) {
  await assertMaster()
  const sessionId = String(formData.get('sessionId') ?? '').trim()
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  // 임시 비밀번호 = 연락처 끝 4자리(연락처 필수)
  const password = passwordFromPhone(phone)
  if (!sessionId || !username || !name || !phone || !password) return
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  if (!session || session.projectId !== projectId) return
  const user = await prisma.user.upsert({
    where: { username },
    update: { name, phone, role: 'SECRETARY' },
    create: { username, name, phone, role: 'SECRETARY', passwordHash: await hashPassword(password), tempPassword: password },
  })
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { connect: { id: user.id } } } })
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { secretaryId: user.id } })
  revalidatePath(`/admin/projects/${projectId}`)
}

// 분과 담당 간사 해제(마스터)
export async function unassignSessionSecretary(projectId: string, sessionId: string) {
  await assertMaster()
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  if (!session || session.projectId !== projectId) return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { secretaryId: null } })
  revalidatePath(`/admin/projects/${projectId}`)
}

// 과제 삭제 — 소속 분과의 projectId는 SetNull(미분류로 남음)
export async function deleteProject(projectId: string) {
  await assertMaster()
  await prisma.project.delete({ where: { id: projectId } })
  redirect('/admin/projects')
}
