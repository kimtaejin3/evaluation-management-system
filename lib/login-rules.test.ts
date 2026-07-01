import { describe, it, expect } from 'vitest'
import { evaluatorLoginError, EVALUATOR_NO_ACTIVE_SESSION_MESSAGE } from './login-rules'

describe('evaluatorLoginError', () => {
  it('평가위원: 진행중 배정 심사가 0개면 로그인 차단(메시지 반환)', () => {
    expect(evaluatorLoginError('EVALUATOR', 0)).toBe(EVALUATOR_NO_ACTIVE_SESSION_MESSAGE)
  })

  it('평가위원: 진행중 배정 심사가 1개 이상이면 허용(null)', () => {
    expect(evaluatorLoginError('EVALUATOR', 1)).toBeNull()
    expect(evaluatorLoginError('EVALUATOR', 3)).toBeNull()
  })

  it('관리자: 진행중 심사가 없어도 항상 허용(null)', () => {
    expect(evaluatorLoginError('MASTER', 0)).toBeNull()
  })
})
