'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/session'

// ⚠️ 데모/프로토타입 전용 — 특정 분과의 평가위원·위원장 계정으로 비밀번호 없이 즉시 로그인.
// 데모 편의를 위해 그 분과를 바로 볼 수 있도록: 해당 분과의 위원 배정을 모두 승인(APPROVED)하고
// 분과가 준비중(DRAFT)이면 진행중(IN_PROGRESS)으로 전환한 뒤, 고른 위원으로 로그인한다.
// (평가 화면은 승인·진행중 배정만 노출하므로) — 정식 배포 전 제거 예정.
export async function demoLoginAs(sessionId: string, userId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    select: { user: { select: { id: true, role: true } }, session: { select: { id: true, status: true } } },
  })
  // 평가위원(위원장 포함)이 실제로 그 분과에 배정돼 있어야 함 — 관리자/담당자 우회 방지
  if (!assignment || assignment.user.role !== 'EVALUATOR') return

  // 데모가 바로 보이도록 이 분과를 진행중·승인 상태로 만든다.
  await prisma.assignment.updateMany({
    where: { sessionId, user: { role: 'EVALUATOR' } },
    data: { status: 'APPROVED' },
  })
  if (assignment.session.status === 'DRAFT') {
    await prisma.evaluationSession.update({ where: { id: sessionId }, data: { status: 'IN_PROGRESS' } })
  }

  const token = await signToken({ userId, role: 'EVALUATOR' })
  const store = await cookies()
  store.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/' })
  redirect('/evaluate')
}
