import { describe, it, expect } from 'vitest'
import { canManageSession, canAccessProject } from './authz'

describe('canManageSession', () => {
  it('마스터는 모든 분과 관리', () => {
    expect(canManageSession('MASTER', 'u1', { secretaryId: 'other' })).toBe(true)
    expect(canManageSession('MASTER', 'u1', { secretaryId: null })).toBe(true)
  })
  it('간사는 자기 분과만', () => {
    expect(canManageSession('SECRETARY', 'u1', { secretaryId: 'u1' })).toBe(true)
    expect(canManageSession('SECRETARY', 'u1', { secretaryId: 'u2' })).toBe(false)
    expect(canManageSession('SECRETARY', 'u1', { secretaryId: null })).toBe(false)
  })
  it('평가위원은 불가', () => {
    expect(canManageSession('EVALUATOR', 'u1', { secretaryId: 'u1' })).toBe(false)
  })
})

describe('canAccessProject', () => {
  it('마스터는 모든 과제', () => {
    expect(canAccessProject('MASTER', 'u1', { secretaries: [] })).toBe(true)
  })
  it('간사는 배정된 과제만', () => {
    expect(canAccessProject('SECRETARY', 'u1', { secretaries: [{ id: 'u1' }] })).toBe(true)
    expect(canAccessProject('SECRETARY', 'u1', { secretaries: [{ id: 'u2' }] })).toBe(false)
  })
})
