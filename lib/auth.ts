import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

export type Role = 'ADMIN' | 'EVALUATOR' | 'SECRETARY'

export interface TokenPayload {
  userId: string
  role: Role
}

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-key-at-least-32-characters-long',
)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return { userId: payload.userId as string, role: payload.role as Role }
  } catch {
    return null
  }
}
