import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { cleanupT1, loginAs, createEvaluator, EVALUATOR_PASSWORD, SESSION_PREFIX, COMPANY_PREFIX, USER_PREFIX } from './helpers'

// 전체 흐름: 위원 제출 → 잠금 → 간사 반려 → 위원 재편집·재제출 → 간사 승인 → 집계 반영
const prisma = new PrismaClient()

let sessionId = ''
let subjectId = ''
let evaluatorId = ''
const EV_USER = `${USER_PREFIX}sub1`

test.beforeAll(async () => {
  const gansa = await prisma.user.findUniqueOrThrow({ where: { username: 'gansa' } })
  const session = await prisma.evaluationSession.create({
    data: { name: `${SESSION_PREFIX}제출승인 분과`, status: 'IN_PROGRESS', secretaryId: gansa.id },
  })
  sessionId = session.id
  const group = await prisma.criterionGroup.create({ data: { sessionId, name: '사업성', maxScore: 20, order: 0 } })
  const subitem = await prisma.criterionSubitem.create({ data: { groupId: group.id, name: '타당성', order: 0 } })
  await prisma.criterion.create({ data: { sessionId, subitemId: subitem.id, name: '지표 A', maxScore: 10, weight: 1, order: 0 } })
  await prisma.criterion.create({ data: { sessionId, subitemId: subitem.id, name: '지표 B', maxScore: 10, weight: 1, order: 1 } })
  const company = await prisma.company.create({ data: { name: `${COMPANY_PREFIX}제출승인 기업` } })
  const subject = await prisma.subject.create({ data: { sessionId, companyId: company.id, name: company.name, order: 0 } })
  subjectId = subject.id
  const evaluator = await createEvaluator(prisma, 'sub1', 'E2E 제출위원')
  evaluatorId = evaluator.id
  await prisma.assignment.create({ data: { sessionId, userId: evaluator.id, status: 'APPROVED' } })
})

test.afterAll(async () => {
  await cleanupT1(prisma)
  await prisma.$disconnect()
})

async function openSheet(page: import('@playwright/test').Page) {
  await page.goto(`/evaluate/${sessionId}/${subjectId}`)
  await expect(page.locator('input[type="number"]').first()).toBeVisible()
}

test('제출→잠금→반려→재제출→승인→집계 반영', async ({ page }) => {
  // 1) 위원 로그인 → 점수 입력 → 제출
  await loginAs(page, EV_USER, EVALUATOR_PASSWORD, '**/evaluate')
  await openSheet(page)
  const inputs = page.locator('input[type="number"]')
  await inputs.nth(0).fill('8')
  await inputs.nth(1).fill('9')
  await page.getByRole('button', { name: '제출 전 확인 →' }).click()
  await page.getByRole('button', { name: '평가 제출' }).click()
  await page.waitForURL(/\/evaluate\?submitted=/)

  // 재진입 시 잠금(입력 비활성 + 대기 배너)
  await openSheet(page)
  await expect(page.locator('input[type="number"]').first()).toBeDisabled()
  await expect(page.getByText('제출됨 · 승인 대기')).toBeVisible()

  // 2) 간사 반려
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')
  await page.goto(`/admin/sessions/${sessionId}/progress`)
  await expect(page.getByText('제출 검토')).toBeVisible()
  await page.getByRole('button', { name: '승인/반려' }).click()
  await page.getByRole('button', { name: '반려', exact: true }).click()
  // 모달이 닫히면(액션 완료) DB 상태 확인
  await expect(page.getByRole('button', { name: '취소' })).toHaveCount(0)
  await expect
    .poll(async () => (await prisma.submission.findUnique({ where: { evaluatorId_subjectId: { evaluatorId, subjectId } } }))?.status)
    .toBe('REJECTED')

  // 3) 위원 재편집 → 재제출
  await loginAs(page, EV_USER, EVALUATOR_PASSWORD, '**/evaluate')
  await openSheet(page)
  await expect(page.getByText('반려됨 · 점수·의견을 수정한 뒤 다시 제출하세요.')).toBeVisible()
  await expect(page.locator('input[type="number"]').first()).toBeEnabled()
  await page.locator('input[type="number"]').nth(0).fill('10')
  await page.getByRole('button', { name: '재제출 확인 →' }).click()
  await page.getByRole('button', { name: '평가 제출' }).click()
  await page.waitForURL(/\/evaluate\?submitted=/)

  // 4) 간사 승인
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')
  await page.goto(`/admin/sessions/${sessionId}/progress`)
  await page.getByRole('button', { name: '승인/반려' }).click()
  await page.getByRole('button', { name: '승인', exact: true }).click()
  await expect(page.getByRole('button', { name: '취소' })).toHaveCount(0)
  // DB: 승인 상태 확정
  await expect
    .poll(async () => (await prisma.submission.findUnique({ where: { evaluatorId_subjectId: { evaluatorId, subjectId } } }))?.status)
    .toBe('APPROVED')

  // 5) 집계 반영: 결과 페이지에 대상·환산 표시(승인분 반영)
  await page.goto(`/admin/sessions/${sessionId}/results`)
  await expect(page.getByText(`${COMPANY_PREFIX}제출승인 기업`).first()).toBeVisible()
})
