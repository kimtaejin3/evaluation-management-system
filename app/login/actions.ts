'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/session'
import { evaluatorLoginError } from '@/lib/login-rules'

export async function login(_prev: unknown, formData: FormData) {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }

  // 평가위원은 진행중인 배정 심사가 있어야 로그인 가능
  if (user.role === 'EVALUATOR') {
    const activeCount = await prisma.assignment.count({
      where: { userId: user.id, status: 'APPROVED', session: { status: 'IN_PROGRESS' } },
    })
    const gateError = evaluatorLoginError(user.role, activeCount)
    if (gateError) return { error: gateError }
  }

  const token = await signToken({ userId: user.id, role: user.role })
  const store = await cookies()
  store.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/' })

  if (user.role === 'MASTER') redirect('/admin/projects')
  if (user.role === 'SECRETARY') {
    // 간사는 첫 참여 과제의 분과 목록으로 — 참여 과제가 없으면 분과 목록(안내)으로
    const first = await prisma.project.findFirst({
      where: { secretaries: { some: { id: user.id } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    redirect(first ? `/admin/projects/${first.id}` : '/admin/sessions')
  }
  redirect('/evaluate')
}

export async function logout() {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
  redirect('/login')
}
