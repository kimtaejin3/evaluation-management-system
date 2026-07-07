// 과제 상태는 소속 분과(EvaluationSession) 상태에서 파생(별도 필드 없음).
export type DerivedProjectStatus = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'

export const PROJECT_STATUS_LABEL: Record<DerivedProjectStatus, string> = {
  DRAFT: '준비',
  IN_PROGRESS: '진행중',
  CLOSED: '완료',
}

/**
 * 분과 상태 목록 → 과제 상태.
 * - 하나라도 진행중이면 진행중
 * - 분과가 있고 전부 마감이면 마감
 * - 그 외(분과 없음/초안 섞임)는 준비중
 */
export function deriveProjectStatus(sessionStatuses: string[]): DerivedProjectStatus {
  if (sessionStatuses.some((s) => s === 'IN_PROGRESS')) return 'IN_PROGRESS'
  if (sessionStatuses.length > 0 && sessionStatuses.every((s) => s === 'CLOSED')) return 'CLOSED'
  return 'DRAFT'
}
