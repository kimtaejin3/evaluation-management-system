import { prisma } from '@/lib/db'
import LoginForm, { type DemoAccount } from './LoginForm'

// 데모 계정은 로그인할 때마다 바뀔 수 있어(위원 배정·위원장 지정) 실제 사용자에서 뽑는다.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const demoAccounts = await getDemoAccounts()
  return <LoginForm demoAccounts={demoAccounts} />
}

// 평가위원 로그인은 '진행중 분과에 승인 배정'이 있어야 통과하므로(로그인 게이트),
// 데모 계정도 실제로 들어가지는 사람만 고른다.
async function getDemoAccounts(): Promise<DemoAccount[]> {
  const [chairSessions, evaluatorAssignment, secretary] = await Promise.all([
    // 위원장 후보 — IN_PROGRESS 분과의 chairId 전체(삭제된 사용자를 가리키는 유령 chairId가 있을 수 있어
    // 아래에서 실제 존재+로그인 가능한 계정만 고른다).
    prisma.evaluationSession.findMany({
      where: { chairId: { not: null }, status: 'IN_PROGRESS' },
      select: { chairId: true },
    }),
    prisma.assignment.findFirst({
      where: { status: 'APPROVED', session: { status: 'IN_PROGRESS' }, user: { role: 'EVALUATOR' } },
      select: { user: { select: { id: true, username: true, name: true, tempPassword: true } } },
    }),
    // 담당자 — 임시 비밀번호가 있는(로그인 가능한) 담당자 아무나. 하드코딩 계정은 없을 수 있다.
    prisma.user.findFirst({
      where: { role: 'SECRETARY', tempPassword: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { username: true, name: true, tempPassword: true },
    }),
  ])

  // 위원장으로 지정됐고 실제 계정이 남아 있으며 임시 비밀번호가 있는 사람만 데모 대상으로 삼는다.
  const chairIds = chairSessions.map((s) => s.chairId).filter((v): v is string => !!v)
  const chair = chairIds.length
    ? await prisma.user.findFirst({
        where: { id: { in: chairIds }, tempPassword: { not: null } },
        select: { username: true, name: true, tempPassword: true },
      })
    : null
  // 위원장과 겹치지 않는 일반 위원을 우선 고른다(둘이 같은 계정이면 구분이 안 된다)
  const evaluator =
    chair && evaluatorAssignment?.user.username === chair.username
      ? (
          await prisma.assignment.findFirst({
            where: {
              status: 'APPROVED',
              session: { status: 'IN_PROGRESS' },
              user: { role: 'EVALUATOR', username: { not: chair.username } },
            },
            select: { user: { select: { username: true, name: true, tempPassword: true } } },
          })
        )?.user ?? evaluatorAssignment.user
      : (evaluatorAssignment?.user ?? null)

  const entry = (
    role: string,
    user: { username: string; name: string; tempPassword: string | null } | null,
    emptyNote: string,
  ): DemoAccount =>
    user?.tempPassword
      ? { role, username: user.username, password: user.tempPassword }
      : { role, disabled: true, note: user ? '비밀번호 미발급' : emptyNote }

  return [
    { role: '관리자', username: 'admin', password: 'admin1234' },
    entry('담당자', secretary, '등록된 담당자 없음'),
    entry('평가위원', evaluator, '배정된 위원 없음'),
    entry('평가위원장', chair, '지정된 위원장 없음'),
  ]
}
