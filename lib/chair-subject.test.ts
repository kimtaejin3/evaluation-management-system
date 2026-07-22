import { describe, it, expect } from 'vitest'
import { chairEvalState, isSubmitted, neighborSubjects } from './chair-subject'

describe('chairEvalState', () => {
  it('전 채점 단위를 입력하면 complete', () => {
    expect(chairEvalState(5, 5)).toBe('complete')
  })
  it('입력 수가 단위 수를 넘어도 complete', () => {
    expect(chairEvalState(6, 5)).toBe('complete')
  })
  it('일부만 입력하면 partial', () => {
    expect(chairEvalState(2, 5)).toBe('partial')
  })
  it('하나도 입력 안 하면 none', () => {
    expect(chairEvalState(0, 5)).toBe('none')
  })
  it('채점 단위가 0개면 입력이 없을 때 none', () => {
    expect(chairEvalState(0, 0)).toBe('none')
  })
})

describe('isSubmitted', () => {
  it('SUBMITTED는 제출', () => {
    expect(isSubmitted('SUBMITTED')).toBe(true)
  })
  it('APPROVED는 제출', () => {
    expect(isSubmitted('APPROVED')).toBe(true)
  })
  it('DRAFT는 미제출', () => {
    expect(isSubmitted('DRAFT')).toBe(false)
  })
  it('REJECTED는 미제출(재작성 상태)', () => {
    expect(isSubmitted('REJECTED')).toBe(false)
  })
  it('기록 없음(null/undefined)은 미제출', () => {
    expect(isSubmitted(null)).toBe(false)
    expect(isSubmitted(undefined)).toBe(false)
  })
})

describe('neighborSubjects', () => {
  const ids = ['a', 'b', 'c']
  it('가운데 대상은 앞뒤 모두 있음', () => {
    expect(neighborSubjects(ids, 'b')).toEqual({ prevSubjectId: 'a', nextSubjectId: 'c' })
  })
  it('첫 대상은 이전이 null', () => {
    expect(neighborSubjects(ids, 'a')).toEqual({ prevSubjectId: null, nextSubjectId: 'b' })
  })
  it('마지막 대상은 다음이 null', () => {
    expect(neighborSubjects(ids, 'c')).toEqual({ prevSubjectId: 'b', nextSubjectId: null })
  })
  it('목록에 없는 대상은 둘 다 null', () => {
    expect(neighborSubjects(ids, 'z')).toEqual({ prevSubjectId: null, nextSubjectId: null })
  })
  it('대상이 하나뿐이면 둘 다 null', () => {
    expect(neighborSubjects(['only'], 'only')).toEqual({ prevSubjectId: null, nextSubjectId: null })
  })
})
