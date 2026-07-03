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

// Tier-1 #3(가장 중요): 채점 → 제출 여정.
// 픽스처: IN_PROGRESS 분과 + 평가항목(그룹1/세부1/지표2) + 대상1 + 평가위원 배정.
let evalUsername = ''
let sessionId = ''
let subjectId = ''
let subjectName = ''
const criterionIds: string[] = []
const MAX_A = 5
const MAX_B = 10

test.beforeAll(async () => {
  const evaluator = await createEvaluator(prisma, 'submit')
  evalUsername = evaluator.username
  subjectName = `${COMPANY_PREFIX}채점대상기업`

  const company = await prisma.company.create({ data: { name: subjectName } })

  const session = await prisma.evaluationSession.create({
    data: {
      name: `${SESSION_PREFIX}채점·제출 분과`,
      status: 'IN_PROGRESS',
      assignments: { create: { userId: evaluator.id } },
    },
  })
  sessionId = session.id

  const subject = await prisma.subject.create({
    data: { sessionId, companyId: company.id, name: company.name, order: 0 },
  })
  subjectId = subject.id

  // 평가항목(그룹) → 세부항목 → 평가지표 2개
  const group = await prisma.criterionGroup.create({
    data: { sessionId, name: '기술성', order: 0 },
  })
  const subitem = await prisma.criterionSubitem.create({
    data: { groupId: group.id, name: '기술개발', order: 0 },
  })
  const c1 = await prisma.criterion.create({
    data: { sessionId, subitemId: subitem.id, name: '기술개발 방향의 적정성', maxScore: MAX_A, order: 0 },
  })
  const c2 = await prisma.criterion.create({
    data: { sessionId, subitemId: subitem.id, name: '사업화 계획의 가능성', maxScore: MAX_B, order: 1 },
  })
  criterionIds.push(c1.id, c2.id)
})

test.afterAll(async () => {
  await cleanupT1(prisma)
  await prisma.$disconnect()
})

test('평가위원 채점 → 제출 전 확인 → 평가 제출 → 완료 안내', async ({ page }) => {
  await loginAs(page, evalUsername, EVALUATOR_PASSWORD, '**/evaluate')

  // 대상 열기 (CSR 점수화면)
  await page.goto(`/evaluate/${sessionId}/${subjectId}`)

  // CSR fetch 후 평가표가 나타날 때까지 대기
  await expect(page.getByRole('heading', { name: /평가표 ·/ })).toBeVisible()

  // 각 지표에 배점 이내 점수 입력 (number input) — 배점 라벨 '/ N' 근처의 입력칸
  const inputs = page.locator('input[type="number"]')
  await expect(inputs).toHaveCount(2)
  await inputs.nth(0).fill(String(MAX_A)) // 5/5
  await inputs.nth(1).fill(String(MAX_B)) // 10/10

  // 합계가 반영되어 제출 버튼 활성화될 때까지 대기
  const submitPre = page.getByRole('button', { name: '제출 전 확인 →' })
  await expect(submitPre).toBeEnabled()
  await submitPre.click()

  // 모달 "평가 제출"
  await expect(page.getByRole('heading', { name: /평가를 제출할까요/ })).toBeVisible()
  await page.getByRole('button', { name: '평가 제출' }).click()

  // 제출 후: 다음 대상 없음 → /evaluate?submitted=... 로 리다이렉트 + 완료 안내
  await page.waitForURL('**/evaluate?submitted=**')
  await expect(page.getByText(/평가가 제출되었습니다/)).toBeVisible()

  // DB에 점수 2건 저장 확인(제출 여정 검증)
  const count = await prisma.score.count({
    where: { subjectId, criterionId: { in: criterionIds } },
  })
  expect(count).toBe(2)
})
