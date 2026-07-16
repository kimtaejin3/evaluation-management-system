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
  const startRaw = String(formData.get('startDate') ?? '').trim()
  const endRaw = String(formData.get('endDate') ?? '').trim()
  const taskType = String(formData.get('taskType') ?? '').trim()
  // 과제명·과제 개요·과제유형·기간(시작일/종료일) 모두 필수
  if (!name || !description || !taskType || !startRaw || !endRaw) return
  const p = await prisma.project.create({
    data: {
      name,
      description,
      // 인쇄 평가표 헤더용 과제유형
      taskType,
      startDate: new Date(startRaw),
      endDate: new Date(endRaw),
    },
  })
  // 사이드바(과제 목록)·과제 관리 화면까지 즉시 반영
  revalidatePath('/admin', 'layout')
  redirect(`/admin/projects/${p.id}`)
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
  revalidatePath('/admin', 'layout')
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
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}`)
}

// 분과 담당 간사 해제(마스터)
export async function unassignSessionSecretary(projectId: string, sessionId: string) {
  await assertMaster()
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  if (!session || session.projectId !== projectId) return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { secretaryId: null } })
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}`)
}

// 과제 삭제 — 소속 분과의 projectId는 SetNull(미분류로 남음)
export async function deleteProject(projectId: string) {
  await assertMaster()
  await prisma.project.delete({ where: { id: projectId } })
  // 사이드바(admin 레이아웃)의 과제 목록 갱신 후 이동
  revalidatePath('/admin', 'layout')
  redirect('/admin/projects')
}

// 과제 참여 간사 추가(마스터) — 간사 관리의 간사 풀에서 골라 이 과제에 연결
export async function addSecretaryToProject(projectId: string, formData: FormData) {
  await assertMaster()
  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role !== 'SECRETARY') return
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { connect: { id: userId } } } })
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}`)
}

// 과제 참여 간사 제외(마스터) — 연결 해제 + 이 과제 내 담당 분과도 함께 해제
export async function removeSecretaryFromProject(projectId: string, userId: string) {
  await assertMaster()
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { disconnect: { id: userId } } } })
  await prisma.evaluationSession.updateMany({ where: { projectId, secretaryId: userId }, data: { secretaryId: null } })
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}`)
}

// 간사 생성(마스터) — 이름·아이디·연락처·사번. 비밀번호는 연락처 끝 4자리로 발급.
// 기존 아이디면 정보를 갱신하며 역할을 간사로 승격한다. 생성 후 원래 과제 화면으로 복귀.
// 과제 화면에서 만들면 그 과제의 참여 간사로 연결되어(project.secretaries) 분과를 만들 수 있다.
export async function createSecretary(formData: FormData) {
  await assertMaster()
  const projectId = String(formData.get('projectId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const username = String(formData.get('username') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const employeeNo = String(formData.get('employeeNo') ?? '').trim() || null
  const password = passwordFromPhone(phone)
  if (!name || !username || !phone || !password) return

  const user = await prisma.user.upsert({
    where: { username },
    update: { name, phone, employeeNo, role: 'SECRETARY' },
    create: {
      username,
      name,
      phone,
      employeeNo,
      role: 'SECRETARY',
      passwordHash: await hashPassword(password),
      tempPassword: password,
    },
  })
  if (projectId) {
    await prisma.project.update({
      where: { id: projectId },
      data: { secretaries: { connect: { id: user.id } } },
    })
  }
  revalidatePath('/admin', 'layout')
  redirect(projectId ? `/admin/projects/${projectId}` : '/admin/secretaries')
}
