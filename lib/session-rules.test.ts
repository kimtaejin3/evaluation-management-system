import { describe, it, expect } from 'vitest'
import { canCloseSession } from './session-rules'

describe('canCloseSession', () => {
  const now = new Date('2026-06-11T09:00:00')

  it('평가 일시가 없으면 마감 가능', () => {
    expect(canCloseSession(null, now)).toBe(true)
    expect(canCloseSession(undefined, now)).toBe(true)
  })

  it('평가 일시가 과거이면 마감 가능', () => {
    expect(canCloseSession(new Date('2026-06-10T09:00:00'), now)).toBe(true)
  })

  it('평가 일시가 미래이면 마감 불가', () => {
    expect(canCloseSession(new Date('2026-06-20T14:00:00'), now)).toBe(false)
  })

  it('평가 일시가 현재와 동일하면 마감 가능', () => {
    expect(canCloseSession(new Date('2026-06-11T09:00:00'), now)).toBe(true)
  })
})
