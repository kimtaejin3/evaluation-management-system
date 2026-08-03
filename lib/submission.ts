// (위원 × 대상) 제출/승인 상태 순수 헬퍼 — prisma/next 의존 없음.
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type CellStatus = 'none' | 'partial' | 'entered' | 'submitted' | 'approved' | 'rejected'

// 위원이 점수·의견을 편집할 수 있는가(제출/승인 시 잠금)
export function canEvaluatorEdit(status: SubmissionStatus | null): boolean {
  return status == null || status === 'DRAFT' || status === 'REJECTED'
}

// 담당자가 승인/반려할 수 있는가(제출완료만)
export function canDecide(status: SubmissionStatus | null): boolean {
  return status === 'SUBMITTED'
}

// 모니터링 셀 상태 — 제출/승인/반려가 있으면 우선, 없으면 입력 수로 판정
export function cellStatus(status: SubmissionStatus | null, filled: number, total: number): CellStatus {
  if (status === 'SUBMITTED') return 'submitted'
  if (status === 'APPROVED') return 'approved'
  if (status === 'REJECTED') return 'rejected'
  if (total > 0 && filled >= total) return 'entered'
  if (filled > 0) return 'partial'
  return 'none'
}

const LABELS: Record<CellStatus, string> = {
  none: '미입력',
  partial: '입력중',
  entered: '입력완료',
  submitted: '제출완료',
  approved: '승인',
  rejected: '반려',
}
export function cellStatusLabel(s: CellStatus): string {
  return LABELS[s]
}
