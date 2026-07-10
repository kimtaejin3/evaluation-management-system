import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import {
  SESSION_PREFIX,
  COMPANY_PREFIX,
  EVALUATOR_PASSWORD,
  cleanupT1,
  createEvaluator,
  loginAs,
} from './helpers'

const prisma = new PrismaClient()

// Tier-1 #1(역할별 로그인 랜딩) + #2(관리영역 접근 차단)
// 픽스처: IN_PROGRESS 분과 + 대상 1 + 평가위원 배정(위원 로그인 게이트 통과 조건).
let evalUsername = ''
let sessionName = ''

test.beforeAll(async () => {
  const evaluator = await createEvaluator(prisma, 'access')
  evalUsername = evaluator.username
  sessionName = `${SESSION_PREFIX}접근·랜딩 분과`

  const company = await prisma.company.create({
    data: { name: `${COMPANY_PREFIX}접근테스트기업` },
  })
  await prisma.evaluationSession.create({
    data: {
      name: sessionName,
      status: 'IN_PROGRESS',
      assignments: { create: { userId: evaluator.id, status: 'APPROVED' } },
      subjects: { create: { companyId: company.id, name: company.name } },
    },
  })
})

test.afterAll(async () => {
  await cleanupT1(prisma)
  await prisma.$disconnect()
})

test('평가위원 로그인 → /evaluate 랜딩(배정 분과 보임)', async ({ page }) => {
  await loginAs(page, evalUsername, EVALUATOR_PASSWORD, '**/evaluate')
  await expect(page.getByRole('heading', { name: '평가 대상 목록' })).toBeVisible()
  // CSR fetch 후 배정 분과명이 나타날 때까지 대기
  await expect(page.getByText(sessionName)).toBeVisible()
})

test('평가위원은 관리영역(/admin/sessions) 접근 불가', async ({ page }) => {
  await loginAs(page, evalUsername, EVALUATOR_PASSWORD, '**/evaluate')
  // requireAdminUser()가 EVALUATOR를 관리영역에서 차단 → 평가위원 홈(/evaluate)으로 되돌림.
  await page.goto('/admin/sessions')
  await page.waitForURL('**/evaluate')
  // 평가위원 홈이 보이고, 관리영역 UI(분과/과제 관리 헤딩)는 렌더되지 않아야 함.
  await expect(page.getByRole('heading', { name: '평가 대상 목록' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '분과 관리' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '과제 관리' })).toHaveCount(0)
})
