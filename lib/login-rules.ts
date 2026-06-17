import type { Role } from './auth'

// 평가위원 로그인 조건: '진행중' 상태의 배정 심사가 1개 이상 있어야 함.
export const EVALUATOR_NO_ACTIVE_SESSION_MESSAGE =
  '현재 진행 중인 심사가 없어 로그인할 수 없습니다. 심사가 시작되면 다시 시도하시거나 관리자에게 문의하세요.'

/**
 * 평가위원 로그인 가능 여부를 판단(순수 함수 — 테스트 대상).
 * 로그인 불가 시 오류 메시지, 가능하면 null.
 * - 평가위원(EVALUATOR): 진행중 배정 심사가 0개면 차단
 * - 관리자 등 그 외 역할: 항상 허용
 */
export function evaluatorLoginError(role: Role, activeAssignedSessionCount: number): string | null {
  if (role === 'EVALUATOR' && activeAssignedSessionCount <= 0) {
    return EVALUATOR_NO_ACTIVE_SESSION_MESSAGE
  }
  return null
}
