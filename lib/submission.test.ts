import { describe, it, expect } from 'vitest'
import { canEvaluatorEdit, cellStatus, cellStatusLabel, canDecide } from './submission'

describe('canEvaluatorEdit', () => {
  it('없음/DRAFT/REJECTED는 편집 가능', () => {
    expect(canEvaluatorEdit(null)).toBe(true)
    expect(canEvaluatorEdit('DRAFT')).toBe(true)
    expect(canEvaluatorEdit('REJECTED')).toBe(true)
  })
  it('SUBMITTED/APPROVED는 잠금', () => {
    expect(canEvaluatorEdit('SUBMITTED')).toBe(false)
    expect(canEvaluatorEdit('APPROVED')).toBe(false)
  })
})

describe('cellStatus', () => {
  it('제출/승인/반려 상태를 우선 반영', () => {
    expect(cellStatus('SUBMITTED', 3, 3)).toBe('submitted')
    expect(cellStatus('APPROVED', 3, 3)).toBe('approved')
    expect(cellStatus('REJECTED', 1, 3)).toBe('rejected')
  })
  it('상태 없음/DRAFT는 입력 수로 판정', () => {
    expect(cellStatus(null, 0, 3)).toBe('none')
    expect(cellStatus(null, 2, 3)).toBe('partial')
    expect(cellStatus('DRAFT', 3, 3)).toBe('entered')
  })
  it('전 항목 수 0이면 none', () => {
    expect(cellStatus(null, 0, 0)).toBe('none')
  })
})

describe('cellStatusLabel', () => {
  it('한국어 라벨', () => {
    expect(cellStatusLabel('entered')).toBe('입력완료')
    expect(cellStatusLabel('submitted')).toBe('제출완료')
    expect(cellStatusLabel('approved')).toBe('승인')
    expect(cellStatusLabel('rejected')).toBe('반려')
  })
})

describe('canDecide', () => {
  it('SUBMITTED만 승인/반려 가능', () => {
    expect(canDecide('SUBMITTED')).toBe(true)
    expect(canDecide('APPROVED')).toBe(false)
    expect(canDecide('DRAFT')).toBe(false)
    expect(canDecide(null)).toBe(false)
  })
})
