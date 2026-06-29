import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SESSION_NAME = 'E2E-PW 평가항목 업로드 테스트'

test.afterAll(async () => {
  // 테스트로 만든 심사 정리
  await prisma.evaluationSession.deleteMany({ where: { name: { startsWith: 'E2E-PW' } } })
  await prisma.$disconnect()
})

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('아이디 입력').fill('admin')
  await page.getByPlaceholder('비밀번호 입력').fill('admin1234')
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('**/admin/sessions')
}

test('엑셀 업로드 모달 — 붙여넣기 → 자동 매핑/미리보기', async ({ page }) => {
  await loginAsAdmin(page)

  // 새 심사 생성
  await page.goto('/admin/sessions/new')
  await page.getByPlaceholder('예) 2026년 상반기 사업 평가').fill(SESSION_NAME)
  await page.getByRole('button', { name: '심사 생성' }).click()
  // 생성 후 세션 상세(cuid)로 리다이렉트 — "new"에 오매칭되지 않도록 길이로 구분
  await page.waitForURL(/\/admin\/sessions\/[a-z0-9]{20,}$/)
  const sessionUrl = page.url()

  // 평가 항목 → 엑셀 업로드 모달
  await page.goto(`${sessionUrl}/criteria`)
  await page.getByRole('button', { name: '엑셀 업로드' }).click()
  await expect(page.getByRole('heading', { name: '엑셀 업로드' })).toBeVisible()

  // 등급 척도표 TSV 붙여넣기(fill은 input 이벤트를 발생시켜 onChange 파싱을 트리거)
  const tsv = [
    '구분\t평가지표\t탁월\t우수\t보통\t미흡\t불량',
    '기술성\t기술개발 방향의 적정성\t5\t4\t3\t2\t1',
    '사업성\t사업화 계획의 가능성\t10\t8\t6\t4\t2',
  ].join('\n')
  await page.locator('textarea').first().fill(tsv)

  // 미리보기: 2개 항목 + 자동 매핑된 세부항목명이 미리보기 표에 보여야 함
  await expect(page.getByText(/2개 항목 생성 예정/)).toBeVisible()
  const preview = page.locator('table').filter({ hasText: '방식' })
  await expect(preview).toContainText('기술개발 방향의 적정성')
  await expect(preview).toContainText('사업화 계획의 가능성')
})
