import { test, expect } from '@playwright/test'

test('관리자 로그인 → 심사 관리 화면', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('아이디 입력').fill('admin')
  await page.getByPlaceholder('비밀번호 입력').fill('admin1234')
  await page.getByRole('button', { name: '로그인' }).click()

  await page.waitForURL('**/admin/sessions')
  await expect(page.getByRole('heading', { name: '심사 관리' })).toBeVisible()
})

test('비로그인 접근은 로그인으로 리다이렉트', async ({ page }) => {
  await page.goto('/admin/sessions')
  await page.waitForURL('**/login')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
})
