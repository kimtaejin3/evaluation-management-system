import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { loginAs } from './helpers'

// 요구사항: 위원 등록→승인→접근, 반려→차단, 검토완료→완료.
// 신규 스펙 전용 접두어(안전수칙): 세션/기업 'E2E-APPR ', 위원 이름 'E2E-APPR 위원'(2는 반려 케이스).
// afterAll에서 이 접두어로만 정리한다. 시드 계정(admin/gansa)은 절대 건드리지 않는다.
const prisma = new PrismaClient()

const SESSION_NAME = 'E2E-APPR 분과'
const COMPANY_NAME = 'E2E-APPR 기업'
const EVALUATOR_NAME = 'E2E-APPR 위원'
const EVALUATOR_NAME_2 = 'E2E-APPR 위원2'

let sessionId = ''

test.beforeAll(async () => {
  const gansa = await prisma.user.findUniqueOrThrow({ where: { username: 'gansa' } })
  const session = await prisma.evaluationSession.create({
    data: { name: SESSION_NAME, status: 'IN_PROGRESS', secretaryId: gansa.id },
  })
  sessionId = session.id
  const group = await prisma.criterionGroup.create({ data: { sessionId, name: '사업성', maxScore: 10, order: 0 } })
  const subitem = await prisma.criterionSubitem.create({ data: { groupId: group.id, name: '타당성', order: 0 } })
  await prisma.criterion.create({ data: { sessionId, subitemId: subitem.id, name: '지표 A', maxScore: 10, weight: 1, order: 0 } })
  const company = await prisma.company.create({ data: { name: COMPANY_NAME } })
  await prisma.subject.create({ data: { sessionId, companyId: company.id, name: company.name, order: 0 } })
})

test.afterAll(async () => {
  // 세션 삭제 시 배정(Assignment)은 cascade로 함께 삭제된다.
  await prisma.evaluationSession.deleteMany({ where: { name: { startsWith: 'E2E-APPR ' } } })
  await prisma.company.deleteMany({ where: { name: { startsWith: 'E2E-APPR ' } } })
  await prisma.user.deleteMany({ where: { name: { startsWith: 'E2E-APPR 위원' } } })
  await prisma.$disconnect()
})

async function attemptEvaluatorLogin(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('아이디 입력').fill(username)
  await page.getByPlaceholder('비밀번호 입력').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
}

test('간사가 신규 위원을 등록하면 대기 상태이며 로그인이 차단된다', async ({ page }) => {
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')
  await page.goto(`/admin/sessions/${sessionId}/evaluators`)

  await page.getByPlaceholder('새 위원 이름').fill(EVALUATOR_NAME)
  await page.getByPlaceholder('연락처(임시비번=끝 4자리)').fill('01000009999')
  await page.getByRole('button', { name: '신규 등록' }).click()

  const row = page.locator('tr').filter({ has: page.getByText(EVALUATOR_NAME, { exact: true }) })
  await expect(row.getByText('대기', { exact: true })).toBeVisible()

  // 등록 직후 DB에서 위원 계정 조회 (아이디는 자동 생성 'ev...', 임시비번=연락처 끝 4자리)
  const ev = await prisma.user.findFirstOrThrow({ where: { name: EVALUATOR_NAME } })
  expect(ev.tempPassword).toBe('9999')

  await attemptEvaluatorLogin(page, ev.username, '9999')
  await expect(page.getByText('현재 진행 중인 심사가 없어 로그인할 수 없습니다')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('관리자가 승인하면 위원이 로그인해 배정 분과에 접근할 수 있다', async ({ page }) => {
  await loginAs(page, 'admin', 'admin1234', '**/admin/projects')
  await page.goto(`/admin/sessions/${sessionId}/evaluators`)

  const row = page.locator('tr').filter({ has: page.getByText(EVALUATOR_NAME, { exact: true }) })
  await row.getByRole('button', { name: '승인', exact: true }).click()
  await expect(row.getByText('승인', { exact: true })).toBeVisible()

  const ev = await prisma.user.findFirstOrThrow({ where: { name: EVALUATOR_NAME } })
  await expect
    .poll(async () => (await prisma.assignment.findUnique({ where: { sessionId_userId: { sessionId, userId: ev.id } } }))?.status)
    .toBe('APPROVED')

  await loginAs(page, ev.username, '9999', '**/evaluate')
  await expect(page.getByText(SESSION_NAME)).toBeVisible()
})

test('반려 경로: 별도 위원 등록 후 관리자가 비승인하면 로그인이 차단된다', async ({ page }) => {
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')
  await page.goto(`/admin/sessions/${sessionId}/evaluators`)
  await page.getByPlaceholder('새 위원 이름').fill(EVALUATOR_NAME_2)
  await page.getByPlaceholder('연락처(임시비번=끝 4자리)').fill('01000009998')
  await page.getByRole('button', { name: '신규 등록' }).click()

  const row2 = page.locator('tr').filter({ has: page.getByText(EVALUATOR_NAME_2, { exact: true }) })
  await expect(row2.getByText('대기', { exact: true })).toBeVisible()

  await loginAs(page, 'admin', 'admin1234', '**/admin/projects')
  await page.goto(`/admin/sessions/${sessionId}/evaluators`)
  const row2Admin = page.locator('tr').filter({ has: page.getByText(EVALUATOR_NAME_2, { exact: true }) })
  await row2Admin.getByRole('button', { name: '비승인', exact: true }).click()
  await expect(row2Admin.getByText('비승인', { exact: true })).toBeVisible()

  const ev2 = await prisma.user.findFirstOrThrow({ where: { name: EVALUATOR_NAME_2 } })
  await expect
    .poll(async () => (await prisma.assignment.findUnique({ where: { sessionId_userId: { sessionId, userId: ev2.id } } }))?.status)
    .toBe('REJECTED')

  await attemptEvaluatorLogin(page, ev2.username, '9998')
  await expect(page.getByText('현재 진행 중인 심사가 없어 로그인할 수 없습니다')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('관리자가 검토 완료하면 분과가 완료 상태가 된다', async ({ page }) => {
  await loginAs(page, 'admin', 'admin1234', '**/admin/projects')
  page.on('dialog', (d) => d.accept())
  await page.goto(`/admin/sessions/${sessionId}/results`)

  await page.getByRole('button', { name: '검토 완료', exact: true }).click()
  await expect(page.getByText('검토 완료됨')).toBeVisible()

  await expect
    .poll(async () => (await prisma.evaluationSession.findUnique({ where: { id: sessionId } }))?.status)
    .toBe('CLOSED')
})
