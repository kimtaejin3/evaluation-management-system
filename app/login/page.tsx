import { prisma } from '@/lib/db'
import LoginForm, { type DemoAccount } from './LoginForm'

// 데모 계정은 로그인할 때마다 바뀔 수 있어(위원 배정·위원장 지정) 실제 사용자에서 뽑는다.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const demoAccounts = await getDemoAccounts()
  return <LoginForm demoAccounts={demoAccounts} />
}

// 데모 계정은 관리자·담당자만 여기서 제공한다.
// 평가위원·평가위원장은 분과 선택이 필요해 아래 '분과별 평가위원 로그인'(/demo-login)에서 처리한다.
async function getDemoAccounts(): Promise<DemoAccount[]> {
  // 담당자 — 임시 비밀번호가 있는(로그인 가능한) 담당자 아무나. 하드코딩 계정은 없을 수 있다.
  const secretary = await prisma.user.findFirst({
    where: { role: 'SECRETARY', tempPassword: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { username: true, name: true, tempPassword: true },
  })

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
  ]
}
