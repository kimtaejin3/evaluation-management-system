// 핵심 기능 통합 테스트 — 실제 DB에 대해 검증(tsx로 실행). 서버 액션의 revalidate/redirect는
// 요청 컨텍스트 밖에서 던지므로, 액션과 동일한 핵심 DB 로직을 재현해 검증한다.
// 실행: npx tsx scripts/core-e2e.ts   (또는 npm run test:core)
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { parseSheet } from '../lib/kpass-sheet'
import { autoDetectMapping, resolveHeader, buildCriteria } from '../lib/kpass-import'
import { autoDetectEvaluatorMapping, buildEvaluators } from '../lib/evaluator-import'
import { parseGradeOptions, isValidScoreValue } from '../lib/scoring'
import { hashPassword, verifyPassword } from '../lib/auth'
import { commitKpassImport } from '../app/admin/sessions/actions'

const prisma = new PrismaClient()
let passed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('✗ FAIL: ' + msg)
  passed++
  console.log('  ✓ ' + msg)
}

const SESSION_PREFIX = 'TEST-CORE '
const SAMPLE_DIR = 'docs/samples'
// 위원 샘플의 이메일(=username) — 정리에 사용
const EV_USERNAMES = [
  'kim.js@example.ac.kr', 'lee.yh@example.re.kr', 'park@example.law.kr',
  'choi@example.cpa.kr', 'jung@example.ac.kr', 'han@example.or.kr',
]

async function cleanup() {
  await prisma.evaluationSession.deleteMany({ where: { name: { startsWith: SESSION_PREFIX } } })
  await prisma.user.deleteMany({
    where: { OR: [{ username: { in: EV_USERNAMES } }, { username: { startsWith: SESSION_PREFIX } }] },
  })
  await prisma.company.deleteMany({ where: { name: { startsWith: SESSION_PREFIX } } })
}

// commitKpassImport 핵심(파싱→매핑→생성) 재현
async function importCriteria(sessionId: string, file: string) {
  const grid = parseSheet(readFileSync(`${SAMPLE_DIR}/${file}`))
  const mapping = autoDetectMapping(resolveHeader(grid, true).header)
  const { rows, warnings } = buildCriteria(grid, mapping, { hasHeader: true, typeMode: 'auto' })
  await prisma.$transaction(async (tx) => {
    await tx.criterion.deleteMany({ where: { sessionId } })
    let order = 0
    for (const r of rows) {
      await tx.criterion.create({
        data: {
          sessionId, section: r.section, name: r.name, description: r.description,
          type: r.type, maxScore: r.maxScore, weight: r.weight, order: order++,
          gradeOptions: r.gradeOptions ? (r.gradeOptions as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      })
    }
  })
  return { rows, warnings }
}

// commitEvaluatorImport 핵심 재현
async function importEvaluators(sessionId: string, file: string) {
  const grid = parseSheet(readFileSync(`${SAMPLE_DIR}/${file}`))
  const { rows } = buildEvaluators(grid, autoDetectEvaluatorMapping(grid[0]), { hasHeader: true })
  const prepared = await Promise.all(rows.map(async (r) => {
    const username = r.username || ('ev' + randomUUID().replace(/-/g, '').slice(0, 6))
    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } })
    if (existing) return { kind: 'existing' as const, username, name: r.name, id: existing.id }
    const pw = randomUUID().replace(/-/g, '').slice(0, 8)
    return { kind: 'new' as const, username, name: r.name, pw, hash: await hashPassword(pw) }
  }))
  const accounts: { name: string; username: string; tempPassword: string | null }[] = []
  await prisma.$transaction(async (tx) => {
    for (const p of prepared) {
      let userId: string
      let tempPassword: string | null = null
      if (p.kind === 'existing') userId = p.id
      else {
        const u = await tx.user.create({
          data: { username: p.username, name: p.name, role: 'EVALUATOR', passwordHash: p.hash, tempPassword: p.pw },
        })
        userId = u.id
        tempPassword = p.pw
      }
      await tx.assignment.upsert({
        where: { sessionId_userId: { sessionId, userId } }, update: {}, create: { sessionId, userId },
      })
      accounts.push({ name: p.name, username: p.username, tempPassword })
    }
  }, { timeout: 20000 })
  return accounts
}

async function main() {
  await cleanup()

  console.log('\n[1] 심사 생성')
  const session = await prisma.evaluationSession.create({ data: { name: SESSION_PREFIX + '회차' } })
  assert(session.status === 'DRAFT', '심사 생성 시 기본 상태 DRAFT')

  console.log('\n[2] 항목 엑셀 등록 — K-PASS 등급 척도표(병합셀/합계행)')
  const r = await importCriteria(session.id, '평가표-예시-K-PASS.xlsx')
  assert(r.warnings.length === 0, '경고 없이 파싱')
  const crit = await prisma.criterion.findMany({ where: { sessionId: session.id }, orderBy: { order: 'asc' } })
  assert(crit.length === 13, `13개 항목 생성(합계행 제외) — 실제 ${crit.length}`)
  assert(crit.every((c) => c.type === 'QUALITATIVE'), '모두 정성(등급) 항목')
  assert(Math.round(crit.reduce((s, c) => s + c.maxScore, 0)) === 100, '배점 합계 100')
  const infra = crit.find((c) => c.name.includes('연구 인프라'))!
  const go = parseGradeOptions(infra.gradeOptions)
  assert(!!go && go.length === 5 && go[1].points === 5, '연구 인프라 등급(가로 병합) 탁월5·우수5 복원')

  console.log('\n[3] 항목 엑셀 등록 — 2행 머리글 자동 인식')
  const s2 = await prisma.evaluationSession.create({ data: { name: SESSION_PREFIX + '2행' } })
  await importCriteria(s2.id, '평가표-예시-2행머리글.xlsx')
  const c2 = await prisma.criterion.findMany({ where: { sessionId: s2.id } })
  assert(c2.length === 3, `2행 머리글 표 → 3개 항목 — 실제 ${c2.length}`)
  assert(c2.every((c) => c.type === 'QUALITATIVE'), '2행 머리글 표 모두 정성')

  console.log('\n[4] 항목 대체(re-import) 멱등성')
  await importCriteria(session.id, '평가표-예시-K-PASS.xlsx')
  const again = await prisma.criterion.count({ where: { sessionId: session.id } })
  assert(again === 13, `재등록(대체) 후에도 13개(중복 없음) — 실제 ${again}`)

  console.log('\n[5] 평가위원 엑셀 등록 — 계정 생성·임시비번·배정')
  const accounts = await importEvaluators(session.id, '평가위원-명단-예시.xlsx')
  assert(accounts.length === 6, `6명 처리 — 실제 ${accounts.length}`)
  assert(accounts.every((a) => a.tempPassword && a.tempPassword.length >= 8), '신규 계정 임시비번 발급')
  assert(accounts[0].username === 'kim.js@example.ac.kr', '이메일이 아이디로 매핑')
  const assigns = await prisma.assignment.count({ where: { sessionId: session.id } })
  assert(assigns === 6, `이 심사에 6명 배정 — 실제 ${assigns}`)

  console.log('\n[6] 위원 재업로드 멱등성(중복 배정/계정 없음)')
  await importEvaluators(session.id, '평가위원-명단-예시.xlsx')
  const assigns2 = await prisma.assignment.count({ where: { sessionId: session.id } })
  const users = await prisma.user.count({ where: { username: { in: EV_USERNAMES } } })
  assert(assigns2 === 6, `재업로드 후 배정 6 유지 — 실제 ${assigns2}`)
  assert(users === 6, `재업로드 후 계정 6 유지(중복 생성 없음) — 실제 ${users}`)

  console.log('\n[7] 점수 제출 — 0점 허용·범위검증·다음 대상 이동')
  const company1 = await prisma.company.create({ data: { name: SESSION_PREFIX + '기업1' } })
  const company2 = await prisma.company.create({ data: { name: SESSION_PREFIX + '기업2' } })
  const sess = await prisma.evaluationSession.create({ data: { name: SESSION_PREFIX + '제출', status: 'IN_PROGRESS' } })
  const cQuant = await prisma.criterion.create({
    data: { sessionId: sess.id, name: '정량항목', type: 'QUANTITATIVE', maxScore: 10, weight: 1, order: 0 },
  })
  const subA = await prisma.subject.create({ data: { sessionId: sess.id, companyId: company1.id, name: '대상A', order: 0 } })
  const subB = await prisma.subject.create({ data: { sessionId: sess.id, companyId: company2.id, name: '대상B', order: 1 } })
  const ev = await prisma.user.create({
    data: { username: SESSION_PREFIX + 'ev', name: '제출테스터', role: 'EVALUATOR', passwordHash: await hashPassword('init') },
  })

  assert(isValidScoreValue(0, 10), '0점은 유효한 점수')
  assert(!isValidScoreValue(15, 10), '만점(10) 초과는 무효')

  // 제출(대상A): 정량 0점 저장 (saveScores의 upsert와 동일)
  await prisma.score.upsert({
    where: { evaluatorId_subjectId_criterionId: { evaluatorId: ev.id, subjectId: subA.id, criterionId: cQuant.id } },
    update: { value: 0, sessionId: sess.id },
    create: { evaluatorId: ev.id, subjectId: subA.id, criterionId: cQuant.id, sessionId: sess.id, value: 0 },
  })
  const savedScore = await prisma.score.findFirst({ where: { subjectId: subA.id, evaluatorId: ev.id } })
  assert(savedScore?.value === 0, '0점이 정상 저장됨')

  // 제출 후 다음 대상 선택(saveScores와 동일: order순 다음)
  const ordered = await prisma.subject.findMany({ where: { sessionId: sess.id }, orderBy: { order: 'asc' }, select: { id: true } })
  const idxA = ordered.findIndex((s) => s.id === subA.id)
  assert(ordered[idxA + 1]?.id === subB.id, '대상A 제출 후 다음은 대상B')
  const idxB = ordered.findIndex((s) => s.id === subB.id)
  assert(ordered[idxB + 1] === undefined, '마지막(대상B) 제출 후 다음 없음 → 목록')

  console.log('\n[8] 채점 시작된 심사 — 항목 대체(replaceCriteria) 차단')
  // sess엔 이미 점수 1건 존재 → commitKpassImport(replace) 호출 시 차단되어야 함(실패 반환, revalidate 미호출)
  const blkGrid = parseSheet(readFileSync(`${SAMPLE_DIR}/평가표-예시-K-PASS.xlsx`))
  const blkMapping = autoDetectMapping(resolveHeader(blkGrid, true).header)
  const blocked = await commitKpassImport(sess.id, {
    grid: blkGrid, mapping: blkMapping, hasHeader: true, typeMode: 'auto', replaceCriteria: true,
  })
  assert(blocked.ok === false && /채점/.test(blocked.error ?? ''), '점수 있는 심사는 항목 대체 차단')

  console.log('\n[9] 위원 비번 재발급 · 계정 삭제')
  const newPw = 'resetpw1'
  await prisma.user.update({ where: { id: ev.id }, data: { passwordHash: await hashPassword(newPw), tempPassword: newPw } })
  const afterReset = await prisma.user.findUnique({ where: { id: ev.id } })
  assert(await verifyPassword(newPw, afterReset!.passwordHash), '재발급된 비번으로 인증 통과')
  assert(afterReset!.tempPassword === newPw, '임시 비밀번호 갱신됨')
  // 계정 삭제 → 점수(Cascade)도 함께 제거
  await prisma.user.delete({ where: { id: ev.id } })
  assert((await prisma.user.findUnique({ where: { id: ev.id } })) === null, '계정 삭제됨')
  assert((await prisma.score.count({ where: { subjectId: subA.id } })) === 0, '계정 삭제 시 점수도 Cascade 제거')

  await cleanup()
  console.log(`\n✅ 핵심 기능 통합 테스트 통과 — 단언 ${passed}건`)
}

main()
  .catch(async (e) => {
    console.error('\n' + (e instanceof Error ? e.message : String(e)))
    await cleanup().catch(() => {})
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
