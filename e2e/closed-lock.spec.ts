import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { SESSION_PREFIX, COMPANY_PREFIX, cleanupT1, loginAs } from './helpers'

const prisma = new PrismaClient()

// Tier-1 #4: CLOSED(마감) 분과의 평가대상 잠금.
// 픽스처: CLOSED 분과 + 대상 1 (담당 간사=시드 gansa). gansa로 로그인해 subjects 페이지 확인.
let sessionId = ''

test.beforeAll(async () => {
  // 시드 간사 계정(실데이터·시드는 수정하지 않고 참조만)
  const gansa = await prisma.user.findUnique({ where: { username: 'gansa' } })
  if (!gansa) throw new Error('시드 간사(gansa) 계정이 없습니다. prisma/seed 필요.')

  const company = await prisma.company.create({
    data: { name: `${COMPANY_PREFIX}마감대상기업` },
  })
  const session = await prisma.evaluationSession.create({
    data: {
      name: `${SESSION_PREFIX}마감 분과`,
      status: 'CLOSED',
      secretaryId: gansa.id,
      subjects: { create: { companyId: company.id, name: company.name } },
    },
  })
  sessionId = session.id
})

test.afterAll(async () => {
  await cleanupT1(prisma)
  await prisma.$disconnect()
})

test('마감(CLOSED) 분과: 잠금 문구 표시 · 제외 버튼 없음', async ({ page }) => {
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')

  await page.goto(`/admin/sessions/${sessionId}/subjects`)

  // 마감 잠금 문구
  await expect(
    page.getByText('마감된 분과는 평가 대상을 수정할 수 없습니다.'),
  ).toBeVisible()

  // 편집 버튼(분과에서 제외)이 없어야 함
  await expect(page.getByRole('button', { name: '분과에서 제외' })).toHaveCount(0)
  // 대상 추가 폼(추가 버튼)도 없어야 함
  await expect(page.getByRole('button', { name: '추가', exact: true })).toHaveCount(0)
})
