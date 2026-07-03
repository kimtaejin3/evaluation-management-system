import { type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Tier-1 E2E 공유 픽스처 접두어(안전수칙: 정리는 이 접두어로만 수행).
export const SESSION_PREFIX = 'E2E-T1 '
export const COMPANY_PREFIX = 'E2E-T1 '
export const USER_PREFIX = 'e2et1_'
export const EVALUATOR_PASSWORD = 'test1234'

// 접두어로만 삭제(순서: EvaluationSession → User → Company). 하위 레코드는 cascade.
export async function cleanupT1(prisma: PrismaClient) {
  await prisma.evaluationSession.deleteMany({ where: { name: { startsWith: SESSION_PREFIX } } })
  await prisma.user.deleteMany({ where: { username: { startsWith: USER_PREFIX } } })
  await prisma.company.deleteMany({ where: { name: { startsWith: COMPANY_PREFIX } } })
}

// 고유 평가위원(EVALUATOR) 생성 — username은 반드시 USER_PREFIX로 시작.
export async function createEvaluator(
  prisma: PrismaClient,
  suffix: string,
  name = 'E2E 평가위원',
) {
  const passwordHash = await bcrypt.hash(EVALUATOR_PASSWORD, 10)
  return prisma.user.create({
    data: { username: `${USER_PREFIX}${suffix}`, passwordHash, name, role: 'EVALUATOR' },
  })
}

export async function loginAs(page: Page, username: string, password: string, waitUrl: string) {
  await page.goto('/login')
  await page.getByPlaceholder('아이디 입력').fill(username)
  await page.getByPlaceholder('비밀번호 입력').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(waitUrl)
}
