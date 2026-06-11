import { chromium } from 'playwright-core'
import { prisma } from '../lib/db'
import { signToken } from '../lib/auth'

const EXEC = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'

async function main() {
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } })
  const kim = await prisma.user.findUnique({ where: { username: 'kim' } })
  const s1 = await prisma.evaluationSession.findFirst({ where: { name: '2026 상반기 사업 평가' } })
  const sub = await prisma.subject.findFirst({ where: { sessionId: s1!.id }, orderBy: { order: 'asc' } })
  const adminTok = await signToken({ userId: admin!.id, role: 'ADMIN' })
  const evalTok = await signToken({ userId: kim!.id, role: 'EVALUATOR' })

  const browser = await chromium.launch({ executablePath: EXEC })

  const shoot = async (token: string, path: string, file: string, w = 1280, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    await ctx.addCookies([{ name: 'auth_token', value: token, domain: 'localhost', path: '/' }])
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' })
    await page.screenshot({ path: 'screenshots/' + file, fullPage: false })
    await ctx.close()
    console.log('  ✓ ' + file + '  (' + path + ')')
  }

  // login (no cookie)
  const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p0 = await ctx0.newPage()
  await p0.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await p0.screenshot({ path: 'screenshots/01-login.png' })
  await ctx0.close()
  console.log('  ✓ 01-login.png')

  await shoot(adminTok, '/admin', '02-admin-dashboard.png')
  await shoot(adminTok, '/admin/evaluators', '11-evaluators.png')
  await shoot(adminTok, '/admin/templates', '12-templates.png')
  await shoot(adminTok, '/admin/sessions/new', '13-new-session.png')
  await shoot(adminTok, `/admin/sessions/${s1!.id}`, '03-session-detail.png')
  await shoot(adminTok, `/admin/sessions/${s1!.id}/criteria`, '04-criteria.png')
  await shoot(adminTok, `/admin/sessions/${s1!.id}/subjects`, '05-subjects-documents.png')
  await shoot(adminTok, `/admin/sessions/${s1!.id}/progress`, '06-progress.png')
  await shoot(adminTok, `/admin/sessions/${s1!.id}/results`, '07-results.png')
  await shoot(adminTok, `/admin/sessions/${s1!.id}/breakdown`, '08-breakdown.png')
  await shoot(evalTok, '/evaluate', '09-evaluate-home.png')
  await shoot(evalTok, `/evaluate/${s1!.id}/${sub!.id}`, '10-score-sheet.png')

  await browser.close()
  console.log('done')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
