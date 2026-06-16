'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/session'

export async function login(_prev: unknown, formData: FormData) {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }

  const token = await signToken({ userId: user.id, role: user.role })
  const store = await cookies()
  store.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/' })

  redirect(user.role === 'ADMIN' ? '/admin/sessions' : user.role === 'SECRETARY' ? '/secretary' : '/evaluate')
}

export async function logout() {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
  redirect('/login')
}
