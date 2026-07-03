import { describe, it, expect } from 'vitest'
import { canManageSession, canAccessProject } from './authz-rules'

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
  it('평가위원은 분과 소유 여부와 무관하게 불가', () => {
    expect(canManageSession('EVALUATOR', 'u1', { secretaryId: 'u1' })).toBe(false)
    expect(canManageSession('EVALUATOR', 'u1', { secretaryId: null })).toBe(false)
  })
  it('간사 userId가 빈 문자열이고 분과도 빈 문자열이면 오탐 방지(!! 로 걸러짐)', () => {
    // secretaryId='' 는 !!로 falsy → 매칭 전에 거부
    expect(canManageSession('SECRETARY', '', { secretaryId: '' })).toBe(false)
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
  it('간사에 배정 간사가 여럿이어도 본인이 포함되면 허용', () => {
    expect(
      canAccessProject('SECRETARY', 'u2', { secretaries: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }] }),
    ).toBe(true)
  })
  it('간사인데 배정 목록이 비면 거부', () => {
    expect(canAccessProject('SECRETARY', 'u1', { secretaries: [] })).toBe(false)
  })
  it('평가위원은 배정 여부와 무관하게 과제 접근 불가', () => {
    expect(canAccessProject('EVALUATOR', 'u1', { secretaries: [{ id: 'u1' }] })).toBe(false)
    expect(canAccessProject('EVALUATOR', 'u1', { secretaries: [] })).toBe(false)
  })
  it('마스터는 배정 목록이 비어도 모든 과제 접근', () => {
    expect(canAccessProject('MASTER', 'u1', { secretaries: [{ id: 'u2' }] })).toBe(true)
  })
})
