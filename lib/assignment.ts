// 배정 상태 관련 순수 유틸(관리 화면/게이트 판정). DB 비의존.
// 배정 승인 워크플로 제거 후: 배정 즉시 활성(REJECTED 만 비활성 — 레거시 데이터 호환).
export type AssignmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// 위원이 평가에 참여 가능한 활성 상태인가 — 반려(REJECTED)만 제외
export function isAssignmentActive(status: AssignmentStatus): boolean {
  return status !== 'REJECTED'
}

const LABELS: Record<AssignmentStatus, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '비승인',
}
export function assignmentStatusLabel(status: AssignmentStatus): string {
  return LABELS[status]
}

// 승인 절차가 없으므로 누가 배정하든 즉시 활성(APPROVED)
export function initialAssignmentStatus(): AssignmentStatus {
  return 'APPROVED'
}
