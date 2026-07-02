import { describe, it, expect } from 'vitest'
import { groupTotal, isGroupBalanced } from './criteria'

describe('groupTotal', () => {
  it('배점 합을 반환', () => {
    expect(groupTotal([{ maxScore: 10 }, { maxScore: 20 }, { maxScore: 5 }])).toBe(35)
  })
  it('빈 배열은 0, 비유한값은 0으로 무시', () => {
    expect(groupTotal([])).toBe(0)
    expect(groupTotal([{ maxScore: NaN }, { maxScore: 10 }])).toBe(10)
  })
})

describe('isGroupBalanced', () => {
  it('목표와 합이 같으면 true(부동소수 허용)', () => {
    expect(isGroupBalanced(50, 50)).toBe(true)
    expect(isGroupBalanced(0.3, 0.1 + 0.2)).toBe(true)
  })
  it('다르면 false', () => {
    expect(isGroupBalanced(50, 45)).toBe(false)
  })
})
