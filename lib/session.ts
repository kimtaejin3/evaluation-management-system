import { cookies } from 'next/headers'
import { verifyToken, type TokenPayload } from './auth'
import { prisma } from './db'

const COOKIE_NAME = 'auth_token'

export async function getCurrentToken(): Promise<TokenPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getCurrentUser() {
  const payload = await getCurrentToken()
  if (!payload) return null
  return prisma.user.findUnique({ where: { id: payload.userId } })
}

export const AUTH_COOKIE = COOKIE_NAME
