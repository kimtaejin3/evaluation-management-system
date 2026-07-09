import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { cleanupT1, loginAs, createEvaluator, SESSION_PREFIX, COMPANY_PREFIX } from './helpers'

// 요구사항: 마스터가 진행중(IN_PROGRESS)으로 둔 분과를, 담당 간사가 접근해 모니터링할 수 있어야 한다.
// 담당이 아닌 분과는 접근 불가여야 한다.
const prisma = new PrismaClient()

const OWNED = `${SESSION_PREFIX}모니터링 담당분과`
const NOT_OWNED = `${SESSION_PREFIX}모니터링 비담당분과`

let ownedId = ''
let notOwnedId = ''
let projectId = ''
let subjectId = ''
let evaluatorId = ''

test.beforeAll(async () => {
  // 시드 간사(gansa)를 담당 간사로 사용. 프로젝트 접근 권한(project.secretaries)도 부여.
  const gansa = await prisma.user.findUniqueOrThrow({ where: { username: 'gansa' } })
  const project = await prisma.project.create({
    data: { name: `${SESSION_PREFIX}모니터링 과제`, secretaries: { connect: { id: gansa.id } } },
  })
  projectId = project.id

  // (1) 담당 간사 = gansa 인 IN_PROGRESS 분과 + 평가항목/대상/위원/점수(진행률>0)
  const owned = await prisma.evaluationSession.create({
    data: { name: OWNED, status: 'IN_PROGRESS', projectId: project.id, secretaryId: gansa.id },
  })
  ownedId = owned.id
  const group = await prisma.criterionGroup.create({ data: { sessionId: owned.id, name: '사업성', maxScore: 10, order: 0 } })
  const subitem = await prisma.criterionSubitem.create({ data: { groupId: group.id, name: '타당성', order: 0 } })
  const criterion = await prisma.criterion.create({
    data: { sessionId: owned.id, subitemId: subitem.id, name: '사업 타당성', maxScore: 10, weight: 1, order: 0 },
  })
  const company = await prisma.company.create({ data: { name: `${COMPANY_PREFIX}모니터링 기업` } })
  const subject = await prisma.subject.create({ data: { sessionId: owned.id, companyId: company.id, name: company.name, order: 0 } })
  subjectId = subject.id
  const evaluator = await createEvaluator(prisma, 'mon1', 'E2E 모니터링 위원')
  evaluatorId = evaluator.id
  await prisma.assignment.create({ data: { sessionId: owned.id, userId: evaluator.id } })
  await prisma.score.create({
    data: { sessionId: owned.id, evaluatorId: evaluator.id, subjectId: subject.id, criterionId: criterion.id, value: 8 },
  })

  // (2) gansa가 담당이 아닌 IN_PROGRESS 분과(secretaryId 미지정)
  const notOwned = await prisma.evaluationSession.create({
    data: { name: NOT_OWNED, status: 'IN_PROGRESS', projectId: project.id, secretaryId: null },
  })
  notOwnedId = notOwned.id
})

test.afterAll(async () => {
  await cleanupT1(prisma)
  await prisma.project.deleteMany({ where: { name: { startsWith: SESSION_PREFIX } } })
  await prisma.$disconnect()
})

test('담당 간사는 자기 IN_PROGRESS 분과를 목록에서 보고 모니터링 페이지에 접근한다', async ({ page }) => {
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')

  // 분과 목록에 담당 분과가 보인다
  await expect(page.getByText(OWNED).first()).toBeVisible()

  // 진행상태(모니터링) 페이지 접근 → 진행률 등 모니터링 지표가 보인다
  await page.goto(`/admin/sessions/${ownedId}/progress`)
  await expect(page.getByText('전체 진행률')).toBeVisible()
  await expect(page.getByText('입력 완료 위원')).toBeVisible()
})

test('담당이 아닌 분과의 모니터링 페이지에는 접근할 수 없다', async ({ page }) => {
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')

  const res = await page.goto(`/admin/sessions/${notOwnedId}/progress`)
  expect(res?.status()).toBe(404)
  await expect(page.getByText('전체 진행률')).toHaveCount(0)
})

test('과제 페이지의 소속 분과 목록에는 담당 분과만 보이고 미배정 분과는 숨긴다', async ({ page }) => {
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')

  await page.goto(`/admin/projects/${projectId}`)
  // 담당 분과는 보이고, 미배정(비담당) 분과는 목록에 없다
  await expect(page.getByText(OWNED).first()).toBeVisible()
  await expect(page.getByText(NOT_OWNED)).toHaveCount(0)
})

test('담당 간사는 집계결과에서 위원별 평가표를 인쇄할 수 있다(접근·양식 확인)', async ({ page }) => {
  // 인쇄 대화상자가 테스트를 막지 않도록 window.print 무력화(실제 인쇄 트리거는 별도 확인 불필요)
  await page.addInitScript(() => { window.print = () => {} })
  await loginAs(page, 'gansa', 'gansa1234', '**/admin/sessions')

  // 집계결과 페이지 접근 → '자세히 보기' 모달에서 위원별 평가표 인쇄 UI 노출(위원 드롭다운·인쇄 버튼)
  await page.goto(`/admin/sessions/${ownedId}/results`)
  await page.getByRole('button', { name: /자세히 보기/ }).click()
  await expect(page.getByText('위원별 평가표 인쇄')).toBeVisible()
  await expect(page.getByRole('button', { name: '인쇄' }).first()).toBeVisible()

  // 인쇄 대상 문서(sheet)에 담당 간사가 접근 가능(200) + 평가표·해당 위원 렌더 → 실제 출력 가능
  const res = await page.goto(`/print/sheet?sessionId=${ownedId}&subjectId=${subjectId}&evaluatorId=${evaluatorId}`)
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: /평가표/ })).toBeVisible()
  await expect(page.getByText('E2E 모니터링 위원')).toBeVisible()

  // 기업별 위원 점수 인쇄 문서도 담당 간사가 접근 가능(200) + 위원 열 렌더
  const res2 = await page.goto(`/print/subject-scores?sessionId=${ownedId}&subjectId=${subjectId}`)
  expect(res2?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: /위원별 점수/ })).toBeVisible()
  await expect(page.getByText('E2E 모니터링 위원')).toBeVisible()
})
