// 순수 권한 판정(테스트 대상) — next/prisma 등 런타임 의존 없음.
export type Role = 'MASTER' | 'SECRETARY' | 'EVALUATOR'

// 분과 관리 권한
export function canManageSession(role: Role, userId: string, session: { secretaryId: string | null }): boolean {
  if (role === 'MASTER') return true
  if (role === 'SECRETARY') return !!session.secretaryId && session.secretaryId === userId
  return false
}

// 과제 접근 권한
export function canAccessProject(role: Role, userId: string, project: { secretaries: { id: string }[] }): boolean {
  if (role === 'MASTER') return true
  if (role === 'SECRETARY') return project.secretaries.some((s) => s.id === userId)
  return false
}
