import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth'

describe('password hashing', () => {
  it('해시 후 검증 성공/실패', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})

describe('jwt', () => {
  it('발급한 토큰을 검증하면 payload 복원', async () => {
    const token = await signToken({ userId: 'u1', role: 'MASTER' })
    const payload = await verifyToken(token)
    expect(payload?.userId).toBe('u1')
    expect(payload?.role).toBe('MASTER')
  })
  it('잘못된 토큰은 null', async () => {
    expect(await verifyToken('garbage')).toBeNull()
  })
})
