import { PrismaClient } from '@prisma/client'
import {
  computeWeightedScore,
  computeFinalScores,
  rankSubjects,
  parseGradeOptions,
  defaultGradeOptions,
  isValidScoreValue,
} from '../lib/scoring'
import { canCloseSession } from '../lib/session-rules'
import { evaluatorLoginError, EVALUATOR_NO_ACTIVE_SESSION_MESSAGE } from '../lib/login-rules'
import { hashPassword, verifyPassword, signToken, verifyToken } from '../lib/auth'
import { getSessionProgress, getSessionInsights } from '../lib/progress'

const prisma = new PrismaClient()

let passed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('✗ ASSERT FAILED: ' + msg)
  passed++
  console.log('  ✓ ' + msg)
}

const E2E_USERNAMES = ['e2e_eval1', 'e2e_eval2', 'e2e_eval3', 'e2e_login_active', 'e2e_login_inactive', 'e2e_login_none']

async function cleanup() {
  const users = await prisma.user.findMany({ where: { username: { in: E2E_USERNAMES } }, select: { id: true } })
  await prisma.opinion.deleteMany({ where: { evaluatorId: { in: users.map((u) => u.id) } } })
  await prisma.evaluationSession.deleteMany({ where: { name: { startsWith: 'E2E ' } } })
  await prisma.user.deleteMany({ where: { username: { in: E2E_USERNAMES } } })
  await prisma.company.deleteMany({ where: { name: { startsWith: 'E2E ' } } })
}

async function main() {
  await cleanup()

  console.log('\n[1] 인증·권한')
  const hash = await hashPassword('pw1234')
  assert(await verifyPassword('pw1234', hash), 'A1 올바른 비밀번호 통과')
  assert(!(await verifyPassword('wrong', hash)), 'A1 틀린 비밀번호 거부')
  const tok = await signToken({ userId: 'u1', role: 'EVALUATOR' })
  const payload = await verifyToken(tok)
  assert(payload?.userId === 'u1' && payload?.role === 'EVALUATOR', 'A2/A3 토큰 라운드트립 + 역할 보존')

  console.log('\n[2] 회차 생성 — 기본 초안')
  const session = await prisma.evaluationSession.create({ data: { name: 'E2E 회차' } })
  assert(session.status === 'DRAFT', 'S1 생성 시 기본 DRAFT')

  console.log('\n[4] 평가 항목 — 정량/정성(등급 옵션)')
  const cQuant = await prisma.criterion.create({ data: { sessionId: session.id, name: 'E2E 정량', type: 'QUANTITATIVE', maxScore: 40, weight: 1, order: 0 } })
  const gradeOpts = [
    { label: '매우 우수', points: 30 },
    { label: '우수', points: 24 },
    { label: '보통', points: 18 },
    { label: '미흡', points: 12 },
    { label: '매우 미흡', points: 6 },
  ]
  const cQual = await prisma.criterion.create({ data: { sessionId: session.id, name: 'E2E 정성', type: 'QUALITATIVE', maxScore: 30, weight: 1, order: 1, gradeOptions: gradeOpts } })
  assert(isValidScoreValue(40, cQuant.maxScore) && !isValidScoreValue(41, cQuant.maxScore), 'K1 정량 범위 검증')
  const reloadedQual = await prisma.criterion.findUnique({ where: { id: cQual.id } })
  const parsed = parseGradeOptions(reloadedQual!.gradeOptions)
  assert(!!parsed && parsed.length === 5 && parsed[0].points === 30, 'K2 정성 등급 옵션 저장·복원')
  assert(defaultGradeOptions(30).length === 5, 'K3 옵션 미지정 시 기본 A~E 폴백')

  console.log('\n[3] 기업·자료(전역) + 회차 편입')
  const coA = await prisma.company.create({ data: { name: 'E2E 기업 A' } })
  const coB = await prisma.company.create({ data: { name: 'E2E 기업 B' } })
  const coC = await prisma.company.create({ data: { name: 'E2E 기업 C' } })
  const again = await prisma.company.upsert({ where: { name: 'E2E 기업 A' }, update: {}, create: { name: 'E2E 기업 A' } })
  assert(again.id === coA.id, 'C1 기업명 유니크(upsert 동일 레코드)')
  await prisma.document.create({ data: { companyId: coA.id, originalName: 'E2E 자료.txt', storedName: 'e2e.txt', mimeType: 'text/plain', size: 10 } })

  const session2 = await prisma.evaluationSession.create({ data: { name: 'E2E 회차2' } })
  const subA = await prisma.subject.create({ data: { sessionId: session.id, companyId: coA.id, name: coA.name, order: 0 } })
  const subB = await prisma.subject.create({ data: { sessionId: session.id, companyId: coB.id, name: coB.name, order: 1 } })
  const subC = await prisma.subject.create({ data: { sessionId: session.id, companyId: coC.id, name: coC.name, order: 2 } }) // 점수 0건(집계 전)
  await prisma.subject.create({ data: { sessionId: session2.id, companyId: coA.id, name: coA.name, order: 0 } })
  const coADocsInS2 = await prisma.company.findUnique({ where: { id: coA.id }, include: { documents: true } })
  assert((coADocsInS2?.documents.length ?? 0) === 1, 'C2 자료는 기업 귀속 → 회차 간 공유')

  let dupBlocked = false
  try {
    await prisma.subject.create({ data: { sessionId: session.id, companyId: coA.id, name: coA.name, order: 9 } })
  } catch {
    dupBlocked = true
  }
  assert(dupBlocked, 'C3 같은 회차에 같은 기업 중복 편입 차단')

  console.log('\n[2] 마감 규칙')
  assert(canCloseSession(null) === true, 'S3 평가 일시 없음 → 마감 가능')
  assert(canCloseSession(new Date('2020-01-01')) === true, 'S3 과거 일시 → 마감 가능')
  assert(canCloseSession(new Date('2999-01-01')) === false, 'S3 미래 일시 → 마감 불가')

  console.log('\n[2] 평가 시작 + 위원 배정')
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { status: 'IN_PROGRESS' } })
  const e1 = await prisma.user.create({ data: { username: 'e2e_eval1', name: 'E2E위원1', role: 'EVALUATOR', passwordHash: hash } })
  const e2 = await prisma.user.create({ data: { username: 'e2e_eval2', name: 'E2E위원2', role: 'EVALUATOR', passwordHash: hash } })
  await prisma.assignment.createMany({ data: [
    { sessionId: session.id, userId: e1.id },
    { sessionId: session.id, userId: e2.id },
  ] })

  console.log('\n[5] 점수 입력(정량 + 정성 등급)')
  const optDoneA = parsed![0] // 매우 우수 30
  const optDoneB = parsed![1] // 우수 24
  // 대상 A: e1 정량40 + 정성30 = 70 ; e2 정량30 + 정성24 = 54 → 평균 62
  // 대상 B: e1 정량20 + 정성18 = 38 ; (e2 미입력 → partial)
  const inserts = [
    { ev: e1.id, sub: subA.id, cr: cQuant.id, value: 40, grade: null },
    { ev: e1.id, sub: subA.id, cr: cQual.id, value: optDoneA.points, grade: optDoneA.label },
    { ev: e2.id, sub: subA.id, cr: cQuant.id, value: 30, grade: null },
    { ev: e2.id, sub: subA.id, cr: cQual.id, value: optDoneB.points, grade: optDoneB.label },
    { ev: e1.id, sub: subB.id, cr: cQuant.id, value: 20, grade: null },
    { ev: e1.id, sub: subB.id, cr: cQual.id, value: parsed![2].points, grade: parsed![2].label },
    { ev: e2.id, sub: subB.id, cr: cQuant.id, value: 10, grade: null }, // 정성 미입력 → partial
  ]
  for (const i of inserts) {
    await prisma.score.create({ data: { sessionId: session.id, evaluatorId: i.ev, subjectId: i.sub, criterionId: i.cr, value: i.value, grade: i.grade } })
  }
  const savedQual = await prisma.score.findFirst({ where: { evaluatorId: e1.id, subjectId: subA.id, criterionId: cQual.id } })
  assert(savedQual?.value === 30 && savedQual?.grade === '매우 우수', 'G4 정성 등급 → 점수/라벨 저장')

  console.log('\n[5] 집계·순위')
  const scores = await prisma.score.findMany({ where: { sessionId: session.id } })
  const weights = [cQuant, cQual].map((c) => ({ id: c.id, weight: c.weight }))
  assert(computeWeightedScore([{ criterionId: cQuant.id, value: 40 }, { criterionId: cQual.id, value: 30 }], weights) === 70, 'G1 가중 점수 = Σ(점수×가중치)')
  const finals = computeFinalScores(scores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })), weights)
  assert(finals.get(subA.id) === 62, `G2 대상A 최종 62 (실제 ${finals.get(subA.id)})`)
  const ranked = rankSubjects(finals)
  assert(ranked[0].subjectId === subA.id && ranked[0].rank === 1, 'G3 대상A 1위')

  console.log('\n[6] 진행·인사이트')
  const prog = await getSessionProgress(session.id)
  const rowE1 = prog.rows.find((r) => r.userId === e1.id)!
  const cellA = rowE1.cells.find((c) => c.subjectId === subA.id)!
  assert(cellA.state === 'done', 'P1 전부 입력 셀 = 완료(done)')
  const rowE2 = prog.rows.find((r) => r.userId === e2.id)!
  const cellB2 = rowE2.cells.find((c) => c.subjectId === subB.id)!
  assert(cellB2.state === 'partial', 'P1 일부 입력 셀 = 입력중(partial)')
  // 완료 칸: e1-A, e2-A, e1-B = 3 / 전체 2위원×3대상 = 6
  assert(prog.doneCells === 3 && prog.totalCells === 6, `P2 진행 칸 3/6 (실제 ${prog.doneCells}/${prog.totalCells})`)

  const insights = await getSessionInsights(session.id)
  const rowAi = insights.rows.find((r) => r.subjectId === subA.id)!
  const rowBi = insights.rows.find((r) => r.subjectId === subB.id)!
  const rowCi = insights.rows.find((r) => r.subjectId === subC.id)!
  assert(rowAi.avg === 62 && rowAi.completeCount === 2, 'P3 대상A 잠정 평균 62(완료 2명)')
  assert(rowBi.avg === 38 && rowBi.completeCount === 1, 'P3 대상B 잠정 평균 38(완료 1명)')
  assert(rowCi.avg === null && rowCi.completeCount === 0, 'P3 점수 0건 대상C는 집계 전(avg=null)')
  assert(rowAi.spread === 16, `P4 대상A 편차 = 70-54 = 16 (실제 ${rowAi.spread})`)
  assert(rowBi.spread === null, 'P4 완료 1명 대상B는 편차 없음(null)')

  console.log('\n[7] 종합의견(위원×대상 1건)')
  await prisma.opinion.upsert({ where: { evaluatorId_subjectId: { evaluatorId: e1.id, subjectId: subA.id } }, update: { text: '수정됨', sessionId: session.id }, create: { evaluatorId: e1.id, subjectId: subA.id, sessionId: session.id, text: '최초' } })
  await prisma.opinion.upsert({ where: { evaluatorId_subjectId: { evaluatorId: e1.id, subjectId: subA.id } }, update: { text: '수정됨2', sessionId: session.id }, create: { evaluatorId: e1.id, subjectId: subA.id, sessionId: session.id, text: 'x' } })
  const ops = await prisma.opinion.findMany({ where: { evaluatorId: e1.id, subjectId: subA.id } })
  assert(ops.length === 1 && ops[0].text === '수정됨2', 'O1 위원×대상 1건 upsert')

  console.log('\n[3] 기업 삭제 cascade')
  await prisma.company.delete({ where: { id: coB.id } })
  const subBStill = await prisma.subject.findUnique({ where: { id: subB.id } })
  assert(subBStill === null, 'C4 기업 삭제 시 편입 Subject도 cascade 삭제')

  console.log('\n[8] 평가위원 로그인 게이트(진행중 심사 필요)')
  const sActive = await prisma.evaluationSession.create({ data: { name: 'E2E 로그인 진행중', status: 'IN_PROGRESS' } })
  const sDraft = await prisma.evaluationSession.create({ data: { name: 'E2E 로그인 초안', status: 'DRAFT' } })
  const sClosed = await prisma.evaluationSession.create({ data: { name: 'E2E 로그인 마감', status: 'CLOSED' } })
  const gActive = await prisma.user.create({ data: { username: 'e2e_login_active', name: 'E2E진행위원', role: 'EVALUATOR', passwordHash: hash } })
  const gInactive = await prisma.user.create({ data: { username: 'e2e_login_inactive', name: 'E2E비활성위원', role: 'EVALUATOR', passwordHash: hash } })
  const gNone = await prisma.user.create({ data: { username: 'e2e_login_none', name: 'E2E미배정위원', role: 'EVALUATOR', passwordHash: hash } })
  await prisma.assignment.create({ data: { sessionId: sActive.id, userId: gActive.id } })
  await prisma.assignment.createMany({ data: [{ sessionId: sDraft.id, userId: gInactive.id }, { sessionId: sClosed.id, userId: gInactive.id }] })

  // 로그인 액션과 동일한 쿼리(진행중 배정 심사 수) → 게이트 판정
  const activeCount = (uid: string) => prisma.assignment.count({ where: { userId: uid, session: { status: 'IN_PROGRESS' } } })
  assert(evaluatorLoginError('EVALUATOR', await activeCount(gActive.id)) === null, 'L1 진행중 배정 위원 → 로그인 허용')
  assert(evaluatorLoginError('EVALUATOR', await activeCount(gInactive.id)) === EVALUATOR_NO_ACTIVE_SESSION_MESSAGE, 'L2 초안/마감만 배정 위원 → 로그인 차단(메시지)')
  assert(evaluatorLoginError('EVALUATOR', await activeCount(gNone.id)) === EVALUATOR_NO_ACTIVE_SESSION_MESSAGE, 'L3 미배정 위원 → 로그인 차단')
  // 진행중 심사가 마감되면 다시 차단되는지
  await prisma.evaluationSession.update({ where: { id: sActive.id }, data: { status: 'CLOSED' } })
  assert(evaluatorLoginError('EVALUATOR', await activeCount(gActive.id)) === EVALUATOR_NO_ACTIVE_SESSION_MESSAGE, 'L4 진행중→마감 전환 시 로그인 차단')
  assert(evaluatorLoginError('ADMIN', 0) === null, 'L5 관리자는 진행중 심사 없어도 허용')

  await cleanup()
  console.log(`\n✅ 통합 E2E 통과 — 단언 ${passed}건`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
