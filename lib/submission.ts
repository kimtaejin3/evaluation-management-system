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

// 평가위원 화면 상단 진행 스텝 — 평가의견 작성 → 제출 → 위원장 검토 → 간사 검토 → 관리자 검토(최종)
export const REVIEW_STAGE_LABELS = [
  '평가의견 작성',
  '제출',
  '위원장 검토 완료',
  '간사 검토 완료',
  '관리자 검토 완료',
] as const

// 평가위원장 화면 상단 진행 스텝 — 평가의견 작성 → 종합의견 작성 → 제출 → 간사 검토 → 관리자 검토(최종)
export const CHAIR_REVIEW_STAGE_LABELS = [
  '평가의견 작성',
  '종합의견 작성',
  '제출',
  '간사 검토 완료',
  '관리자 검토 완료',
] as const

// 위원장 진행 5단계 완료 플래그 — 평가의견 작성 · 종합의견 작성 · 제출 · 간사 검토 · 관리자 검토.
// 위원장은 점수 입력 후 종합의견을 쓰고 제출하므로 단계가 선형이 아니라 조건별로 판정한다.
export function chairReviewFlags(opts: {
  status: SubmissionStatus | null
  scored: boolean
  opinionWritten: boolean
  sessionClosed: boolean
}): boolean[] {
  const submitted = opts.status === 'SUBMITTED' || opts.status === 'APPROVED'
  const approved = opts.status === 'APPROVED'
  return [
    opts.scored || submitted, // 1 평가의견 작성
    opts.opinionWritten, // 2 종합의견 작성
    submitted, // 3 제출
    approved, // 4 간사 검토 완료
    opts.sessionClosed && approved, // 5 관리자 검토 완료
  ]
}

// 평가위원 진행 5단계 완료 플래그 — 평가의견 작성 · 제출 · 위원장 검토 · 간사 검토 · 관리자 검토.
// 위원장 검토(chairConfirmed)는 간사 승인과 독립으로 판정한다(승인됐다고 위원장 검토를 자동 완료로 보지 않음).
export function reviewFlags(opts: {
  status: SubmissionStatus | null
  scored: boolean
  chairConfirmed: boolean
  sessionClosed: boolean
}): boolean[] {
  const submitted = opts.status === 'SUBMITTED' || opts.status === 'APPROVED'
  const approved = opts.status === 'APPROVED'
  return [
    opts.scored || submitted, // 평가의견 작성
    submitted, // 제출
    opts.chairConfirmed, // 위원장 검토 완료
    approved, // 간사 검토 완료
    opts.sessionClosed && approved, // 관리자 검토 완료
  ]
}
