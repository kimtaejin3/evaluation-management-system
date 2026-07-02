import { describe, it, expect } from 'vitest'
import { phoneDigits, passwordFromPhone } from './phone'

describe('phoneDigits', () => {
  it('하이픈·공백을 제거하고 숫자만 남긴다', () => {
    expect(phoneDigits('010-1234-5678')).toBe('01012345678')
    expect(phoneDigits('010 1234 5678')).toBe('01012345678')
    expect(phoneDigits('+82 10-1234-5678')).toBe('821012345678')
  })
  it('null/undefined/빈값은 빈 문자열', () => {
    expect(phoneDigits(null)).toBe('')
    expect(phoneDigits(undefined)).toBe('')
    expect(phoneDigits('')).toBe('')
  })
})

describe('passwordFromPhone', () => {
  it('연락처 끝 4자리를 반환한다', () => {
    expect(passwordFromPhone('010-1234-5678')).toBe('5678')
    expect(passwordFromPhone('01012345678')).toBe('5678')
    expect(passwordFromPhone('1234')).toBe('1234')
  })
  it('숫자가 4자리 미만이면 null', () => {
    expect(passwordFromPhone('123')).toBeNull()
    expect(passwordFromPhone('')).toBeNull()
    expect(passwordFromPhone(null)).toBeNull()
  })
})
