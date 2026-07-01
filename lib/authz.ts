import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canManageSession, canAccessProject, type Role } from './authz-rules'

export { canManageSession, canAccessProject }
export type { Role }

// 로그인 + 관리영역(마스터/간사) 강제
export async function requireAdminUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'MASTER' && user.role !== 'SECRETARY') notFound()
  return user
}

export async function assertMaster() {
  const user = await requireAdminUser()
  if (user.role !== 'MASTER') notFound()
  return user
}

// 분과 접근 — 권한 없으면 notFound
export async function assertSessionAccess(sessionId: string) {
  const user = await requireAdminUser()
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session) notFound()
  if (!canManageSession(user.role as Role, user.id, session)) notFound()
  return { user, session }
}

// 과제 접근 — 권한 없으면 notFound
export async function assertProjectAccess(projectId: string) {
  const user = await requireAdminUser()
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { secretaries: { select: { id: true } } },
  })
  if (!project) notFound()
  if (!canAccessProject(user.role as Role, user.id, project)) notFound()
  return { user, project }
}
