import { test, expect } from '@playwright/test'

test('마스터 로그인 → 과제 관리 화면', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('아이디 입력').fill('admin')
  await page.getByPlaceholder('비밀번호 입력').fill('admin1234')
  await page.getByRole('button', { name: '로그인' }).click()

  await page.waitForURL('**/admin/projects')
  await expect(page.getByRole('heading', { name: '과제 관리' })).toBeVisible()
})

test('간사 로그인 → 내 분과(분과 목록)', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('아이디 입력').fill('gansa')
  await page.getByPlaceholder('비밀번호 입력').fill('gansa1234')
  await page.getByRole('button', { name: '로그인' }).click()

  await page.waitForURL('**/admin/sessions')
})

test('비로그인 접근은 로그인으로 리다이렉트', async ({ page }) => {
  await page.goto('/admin/sessions')
  await page.waitForURL('**/login')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
})
