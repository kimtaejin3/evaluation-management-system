// 배정 승인 상태 관련 순수 유틸(관리 화면/게이트 판정). DB 비의존.
export type AssignmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// 위원이 평가에 참여 가능한 활성 상태인가(승인된 배정만)
export function isAssignmentActive(status: AssignmentStatus): boolean {
  return status === 'APPROVED'
}

const LABELS: Record<AssignmentStatus, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '비승인',
}
export function assignmentStatusLabel(status: AssignmentStatus): string {
  return LABELS[status]
}

// 등록 주체 역할에 따른 초기 상태: 관리자=즉시 승인, 담당자=관리자 승인 대기
export function initialAssignmentStatus(actorRole: 'MASTER' | 'SECRETARY'): AssignmentStatus {
  return actorRole === 'MASTER' ? 'APPROVED' : 'PENDING'
}
