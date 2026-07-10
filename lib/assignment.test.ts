import { describe, it, expect } from 'vitest'
import { isAssignmentActive, assignmentStatusLabel, initialAssignmentStatus } from './assignment'

describe('isAssignmentActive', () => {
  it('APPROVED만 활성', () => {
    expect(isAssignmentActive('APPROVED')).toBe(true)
    expect(isAssignmentActive('PENDING')).toBe(false)
    expect(isAssignmentActive('REJECTED')).toBe(false)
  })
})

describe('assignmentStatusLabel', () => {
  it('상태 라벨', () => {
    expect(assignmentStatusLabel('PENDING')).toBe('대기')
    expect(assignmentStatusLabel('APPROVED')).toBe('승인')
    expect(assignmentStatusLabel('REJECTED')).toBe('비승인')
  })
})

describe('initialAssignmentStatus', () => {
  it('관리자 등록은 즉시 승인, 간사는 대기', () => {
    expect(initialAssignmentStatus('MASTER')).toBe('APPROVED')
    expect(initialAssignmentStatus('SECRETARY')).toBe('PENDING')
  })
})
