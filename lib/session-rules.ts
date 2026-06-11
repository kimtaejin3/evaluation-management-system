// 회차 상태 전이 규칙 (순수 함수 — 테스트 대상)

/**
 * 회차를 '마감'할 수 있는가?
 * - 평가 일시가 없으면 마감 가능
 * - 평가 일시가 현재보다 미래이면 마감 불가 (아직 평가가 끝나지 않음)
 */
export function canCloseSession(eventDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (!eventDate) return true
  return new Date(eventDate).getTime() <= now.getTime()
}

export const CLOSE_BLOCKED_MESSAGE = '평가 일시가 지나기 전에는 회차를 마감할 수 없습니다.'
