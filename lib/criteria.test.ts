import { describe, it, expect } from 'vitest'
import { groupTotal, isGroupBalanced, criteriaGrandTotal, isTotalValid, TOTAL_SCORE } from './criteria'

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

describe('criteriaGrandTotal', () => {
  const groups = [
    { subitems: [{ criteria: [{ maxScore: 30 }, { maxScore: 10 }] }, { criteria: [{ maxScore: 10 }] }] },
    { subitems: [{ criteria: [{ maxScore: 50 }] }] },
  ]
  it('모든 평가지표 배점의 합을 반환', () => {
    expect(criteriaGrandTotal(groups)).toBe(100)
  })
  it('빈 구조는 0', () => {
    expect(criteriaGrandTotal([])).toBe(0)
    expect(criteriaGrandTotal([{ subitems: [] }])).toBe(0)
  })
})

describe('isTotalValid', () => {
  it('100이면 true(부동소수 허용)', () => {
    expect(isTotalValid(TOTAL_SCORE)).toBe(true)
    expect(isTotalValid(40 + 30 + 30)).toBe(true)
  })
  it('100이 아니면 false', () => {
    expect(isTotalValid(90)).toBe(false)
    expect(isTotalValid(110)).toBe(false)
  })
})
