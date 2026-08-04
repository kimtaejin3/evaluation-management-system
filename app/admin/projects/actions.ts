'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { assertMaster } from '@/lib/authz'
import { hashPassword } from '@/lib/auth'
import { passwordFromPhone } from '@/lib/phone'
import { purgeSession } from '@/app/admin/sessions/actions'

export async function createProject(formData: FormData) {
  await assertMaster()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const startRaw = String(formData.get('startDate') ?? '').trim()
  const endRaw = String(formData.get('endDate') ?? '').trim()
  const taskType = String(formData.get('taskType') ?? '').trim()
  // 사업명·사업 개요·사업유형·기간(시작일/종료일) 모두 필수
  if (!name || !description || !taskType || !startRaw || !endRaw) return
  const p = await prisma.project.create({
    data: {
      name,
      description,
      // 인쇄 평가표 헤더용 사업유형
      taskType,
      startDate: new Date(startRaw),
      endDate: new Date(endRaw),
    },
  })
  // 사이드바(사업 목록)·사업 관리 화면까지 즉시 반영
  revalidatePath('/admin', 'layout')
  redirect(`/admin/projects/${p.id}`)
}

// 사업 정보 수정(마스터) — 사업 정보 변경 모달에서 호출. 이름/개요/유형/기간.
export async function updateProject(
  projectId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await assertMaster()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const taskType = String(formData.get('taskType') ?? '').trim()
  const startRaw = String(formData.get('startDate') ?? '').trim()
  const endRaw = String(formData.get('endDate') ?? '').trim()
  if (!name) return { ok: false, error: '사업명은 필수입니다.' }
  if (startRaw && endRaw && new Date(endRaw) < new Date(startRaw)) {
    return { ok: false, error: '종료일이 시작일보다 빠릅니다.' }
  }
  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      description: description || null,
      taskType: taskType || null,
      startDate: startRaw ? new Date(startRaw) : null,
      endDate: endRaw ? new Date(endRaw) : null,
    },
  })
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}`)
  return { ok: true }
}

// "배정" = 담당자(기존 선택)를 분과에 배정. 사업 접근 권한도 함께 부여(project.secretaries).
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

// "배정" = 담당자 계정을 새로 만들고 곧바로 분과에 배정(+사업 접근 부여).
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

// 분과 담당자 해제(마스터)
export async function unassignSessionSecretary(projectId: string, sessionId: string) {
  await assertMaster()
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  if (!session || session.projectId !== projectId) return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { secretaryId: null } })
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}`)
}

// 사업 삭제 — 소속 분과의 projectId는 SetNull(미분류로 남음)
export async function deleteProject(projectId: string) {
  await assertMaster()
  // 분과(EvaluationSession)는 project FK가 onDelete:SetNull이라, 사업만 지우면 분과가
  // projectId=null 고아로 남아 평가위원 화면·관리 화면에 계속 노출된다. 사업의 모든 분과를
  // 먼저 정리(자료·의견까지)해 고아가 생기지 않도록 한다.
  const sessions = await prisma.evaluationSession.findMany({ where: { projectId }, select: { id: true } })
  for (const s of sessions) {
    await purgeSession(s.id)
  }
  await prisma.project.delete({ where: { id: projectId } })
  // 사이드바(admin 레이아웃)의 사업 목록 갱신 후 이동
  revalidatePath('/admin', 'layout')
  redirect('/admin/projects')
}

// 사업 참여 담당자 추가(마스터) — 담당자 관리의 담당자 풀에서 골라 이 사업에 연결
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

// 사업 참여 담당자 제외(마스터) — 연결 해제 + 이 사업 내 담당 분과도 함께 해제
export async function removeSecretaryFromProject(projectId: string, userId: string) {
  await assertMaster()
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { disconnect: { id: userId } } } })
  await prisma.evaluationSession.updateMany({ where: { projectId, secretaryId: userId }, data: { secretaryId: null } })
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}`)
}

// 담당자 생성(마스터) — 이름·아이디·연락처·비밀번호. 비밀번호 미입력 시 연락처 끝 4자리로 발급.
// 기존 아이디면 정보를 갱신하며 역할을 담당자로 승격한다. 생성 후 원래 사업 화면으로 복귀.
// 사업 화면에서 만들면 그 사업의 참여 담당자로 연결되어(project.secretaries) 분과를 만들 수 있다.
export async function createSecretary(formData: FormData) {
  await assertMaster()
  const projectId = String(formData.get('projectId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const username = String(formData.get('username') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  // 비밀번호는 폼에서 직접 지정 가능(비우면 연락처 끝 4자리). 관리자가 값을 눈으로 확인·설정하도록.
  const passwordInput = String(formData.get('password') ?? '').trim()
  const password = passwordInput || passwordFromPhone(phone)
  if (!name || !username || !phone || !password) return

  const user = await prisma.user.upsert({
    where: { username },
    update: { name, phone, role: 'SECRETARY' },
    create: {
      username,
      name,
      phone,
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
