import { describe, it, expect } from 'vitest'
import { deriveProjectStatus } from './project-status'

describe('deriveProjectStatus', () => {
  it('하나라도 진행중이면 진행중', () => {
    expect(deriveProjectStatus(['DRAFT', 'IN_PROGRESS', 'CLOSED'])).toBe('IN_PROGRESS')
  })
  it('분과가 있고 전부 마감이면 마감', () => {
    expect(deriveProjectStatus(['CLOSED', 'CLOSED'])).toBe('CLOSED')
  })
  it('초안 섞임(진행중 없음)은 준비중', () => {
    expect(deriveProjectStatus(['DRAFT', 'CLOSED'])).toBe('DRAFT')
    expect(deriveProjectStatus(['DRAFT'])).toBe('DRAFT')
  })
  it('분과 없으면 준비중', () => {
    expect(deriveProjectStatus([])).toBe('DRAFT')
  })
})
