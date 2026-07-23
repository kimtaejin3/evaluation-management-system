import { PrismaClient } from '@prisma/client'
import {
  computeWeightedScore,
  computeFinalScores,
  rankSubjects,
  isValidScoreValue,
} from '../lib/scoring'
import { canCloseSession } from '../lib/session-rules'
import { evaluatorLoginError, EVALUATOR_NO_ACTIVE_SESSION_MESSAGE } from '../lib/login-rules'
import { hashPassword, verifyPassword, signToken, verifyToken } from '../lib/auth'
import { getSessionProgress, getSessionInsights } from '../lib/progress'
import { getChairSubjectData } from '../lib/evaluate-data'

const prisma = new PrismaClient()

// ── 서버 액션을 스크립트에서 그대로 호출하기 위한 최소 스텁 ──
// saveChairOpinion은 로그인 쿠키(next/headers)와 revalidatePath(next/cache)에 의존한다.
// 요청 컨텍스트가 없는 스크립트에서는 두 모듈만 갈아끼워 실제 가드 로직을 그대로 검증한다.
let authToken = ''
const nodeModule = require('module') as { _load: (...args: unknown[]) => unknown }
const origLoad = nodeModule._load
nodeModule._load = function (this: unknown, request: unknown, ...rest: unknown[]) {
  if (request === 'next/headers') {
    return { cookies: async () => ({ get: (n: string) => (n === 'auth_token' && authToken ? { value: authToken } : undefined) }) }
  }
  if (request === 'next/cache') return { revalidatePath: () => {}, revalidateTag: () => {} }
  return origLoad.call(this, request, ...rest)
} as typeof nodeModule._load

// 위 스텁을 설치한 뒤에 로드해야 한다(정적 import는 스텁보다 먼저 실행됨)
const { saveChairOpinion } = require('../app/evaluate/actions') as typeof import('../app/evaluate/actions')

// 이후 서버 액션 호출의 로그인 사용자를 바꾼다
async function asUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } })
  authToken = await signToken({ userId, role: user.role })
}

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

  console.log('\n[4] 평가 항목 — 그룹→세부항목→리프(평가지표), 전부 숫자 배점')
  const gA = await prisma.criterionGroup.create({ data: { sessionId: session.id, name: 'E2E 그룹A', maxScore: 40, order: 0 } })
  const subA1 = await prisma.criterionSubitem.create({ data: { groupId: gA.id, name: 'E2E 세부A', order: 0 } })
  const cQuant = await prisma.criterion.create({ data: { sessionId: session.id, subitemId: subA1.id, name: 'E2E 정량', maxScore: 40, weight: 1, order: 0 } })

  const gB = await prisma.criterionGroup.create({ data: { sessionId: session.id, name: 'E2E 그룹B', maxScore: 30, order: 1 } })
  const subB1 = await prisma.criterionSubitem.create({ data: { groupId: gB.id, name: 'E2E 세부B', order: 0 } })
  const cQual = await prisma.criterion.create({ data: { sessionId: session.id, subitemId: subB1.id, name: 'E2E 항목2', maxScore: 30, weight: 1, order: 1 } })
  assert(isValidScoreValue(40, cQuant.maxScore) && !isValidScoreValue(41, cQuant.maxScore), 'K1 정량 범위 검증')
  assert(!isValidScoreValue(31, cQual.maxScore), 'K2 배점 상한(30) 초과값은 무효')
  assert(cQuant.subitemId === subA1.id && cQual.subitemId === subB1.id, 'K3 리프가 각자의 세부항목에 연결됨')

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
  const subA2 = await prisma.subject.create({ data: { sessionId: session2.id, companyId: coA.id, name: coA.name, order: 0 } })
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
  // 배정은 승인(APPROVED) 상태여야 평가에 참여한다(진행 현황·저장 가드 모두 승인 배정 기준)
  await prisma.assignment.createMany({ data: [
    { sessionId: session.id, userId: e1.id, status: 'APPROVED' },
    { sessionId: session.id, userId: e2.id, status: 'APPROVED' },
  ] })
  // e1을 평가위원장으로 — 종합의견은 위원장만 작성한다
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { chairId: e1.id } })

  console.log('\n[5] 점수 입력(항목1 + 항목2, 전부 숫자)')
  // 대상 A: e1 정량40 + 항목2=30 = 70 ; e2 정량30 + 항목2=24 = 54 → 평균 62
  // 대상 B: e1 정량20 + 항목2=18 = 38 ; (e2 항목2 미입력 → partial)
  const inserts = [
    { ev: e1.id, sub: subA.id, cr: cQuant.id, value: 40 },
    { ev: e1.id, sub: subA.id, cr: cQual.id, value: 30 },
    { ev: e2.id, sub: subA.id, cr: cQuant.id, value: 30 },
    { ev: e2.id, sub: subA.id, cr: cQual.id, value: 24 },
    { ev: e1.id, sub: subB.id, cr: cQuant.id, value: 20 },
    { ev: e1.id, sub: subB.id, cr: cQual.id, value: 18 },
    { ev: e2.id, sub: subB.id, cr: cQuant.id, value: 10 }, // 항목2 미입력 → partial
  ]
  for (const i of inserts) {
    await prisma.score.create({ data: { sessionId: session.id, evaluatorId: i.ev, subjectId: i.sub, criterionId: i.cr, value: i.value } })
  }
  // 집계(잠정 순위·편차)는 승인(APPROVED)된 (위원×대상) 제출만 반영 → 전 항목 입력분을 승인 처리
  await prisma.submission.createMany({ data: [
    { sessionId: session.id, evaluatorId: e1.id, subjectId: subA.id, status: 'APPROVED', submittedAt: new Date() },
    { sessionId: session.id, evaluatorId: e2.id, subjectId: subA.id, status: 'APPROVED', submittedAt: new Date() },
    { sessionId: session.id, evaluatorId: e1.id, subjectId: subB.id, status: 'APPROVED', submittedAt: new Date() },
  ] })
  const savedQual = await prisma.score.findFirst({ where: { evaluatorId: e1.id, subjectId: subA.id, criterionId: cQual.id } })
  assert(savedQual?.value === 30, 'G4 숫자 점수 저장 확인')

  console.log('\n[5] 집계·순위')
  const scores = await prisma.score.findMany({ where: { sessionId: session.id } })
  const weights = [cQuant, cQual].map((c) => ({ id: c.id, weight: c.weight }))
  assert(computeWeightedScore([{ criterionId: cQuant.id, value: 40 }, { criterionId: cQual.id, value: 30 }], weights) === 70, 'G1 가중 점수 = Σ(점수×가중치)')
  const finals = computeFinalScores(scores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId ?? s.subitemId ?? '', value: s.value })), weights)
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

  console.log('\n[7] 위원장 종합의견 — 대상별 화면(위원장 종합의견)에서만 작성(위원장×대상 1건)')
  // 실제 서버 액션(saveChairOpinion)을 그대로 호출한다 — 로그인 쿠키는 스텁으로 주입.
  // 저장 위치는 다른 위원과 같은 Opinion(위원×대상) 한 행이다.
  const opinionFd = (text: string) => { const fd = new FormData(); fd.set('opinion', text); return fd }
  const chairOpinionOf = async (subjectId: string) =>
    (await prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: e1.id, subjectId } }, select: { text: true } }))?.text ?? null

  await asUser(e1.id) // 위원장
  assert((await saveChairOpinion(session.id, subA.id, opinionFd('최초'))).ok, 'O1 위원장은 종합의견을 저장할 수 있다')
  assert((await saveChairOpinion(session.id, subA.id, opinionFd('수정됨2'))).ok, 'O1 재저장(upsert)도 허용')
  const ops = await prisma.opinion.findMany({ where: { subjectId: subA.id } })
  assert(ops.length === 1 && ops[0].evaluatorId === e1.id && ops[0].text === '수정됨2', 'O1 위원장×대상 1건 upsert')

  // 다른 분과(session2)의 대상은 거부 — 분과 경계
  const wrongSubject = await saveChairOpinion(session.id, subA2.id, opinionFd('남의 분과'))
  assert(!wrongSubject.ok && wrongSubject.error === '해당 분과의 평가 대상이 아닙니다.', 'O2 다른 분과의 대상은 저장 거부')
  assert((await prisma.opinion.count({ where: { subjectId: subA2.id } })) === 0, 'O2 거부 시 Opinion 미생성')

  await asUser(e2.id) // 위원장 아님
  const nonChair = await saveChairOpinion(session.id, subA.id, opinionFd('위원 의견'))
  assert(!nonChair.ok && nonChair.error === '위원장만 작성할 수 있습니다.', 'O3 위원장이 아니면 저장 거부')
  assert((await chairOpinionOf(subA.id)) === '수정됨2', 'O3 거부 시 원본 불변')

  // 의견서가 검토 제출(SUBMITTED)되면 위원장도 수정·삭제할 수 없다
  await asUser(e1.id)
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { opinionStatus: 'SUBMITTED' } })
  const lockedSave = await saveChairOpinion(session.id, subA.id, opinionFd('제출 후 수정'))
  assert(!lockedSave.ok && lockedSave.error === '의견서가 제출/승인되어 수정할 수 없습니다.', 'O4 의견서 제출 후 저장 거부')
  const lockedDelete = await saveChairOpinion(session.id, subA.id, opinionFd(''))
  assert(!lockedDelete.ok, 'O4 의견서 제출 후 삭제(빈 값)도 거부')
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { opinionStatus: 'APPROVED' } })
  const approvedSave = await saveChairOpinion(session.id, subA.id, opinionFd('승인 후 수정'))
  assert(!approvedSave.ok && approvedSave.error === '의견서가 제출/승인되어 수정할 수 없습니다.', 'O4 의견서 승인 후에도 저장 거부')
  assert((await chairOpinionOf(subA.id)) === '수정됨2', 'O4 거부 시 DB 원본 그대로')

  // 화면(위원장 대상별 상세)도 같은 규칙 — 읽기 전용 + 사유
  const lockedView = await getChairSubjectData(e1.id, session.id, subA.id)
  assert(lockedView?.locked === true && lockedView?.lockReason === 'opinionReviewed', 'O4 화면도 읽기 전용(사유=의견서 제출/승인)')
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { opinionStatus: 'DRAFT' } })

  console.log('\n[7] 위원장 대상별 상세 조회 권한')
  const chairView = await getChairSubjectData(e1.id, session.id, subA.id)
  assert(chairView !== null && chairView.chairOpinion === '수정됨2', 'O5 위원장은 대상별 상세를 열람(저장한 종합의견 포함)')
  assert(chairView!.locked === false && chairView!.lockReason === null, 'O5 진행중·검토 전이면 편집 가능')
  assert((await getChairSubjectData(e2.id, session.id, subA.id)) === null, 'O6 위원장이 아니면 null(라우트에서 403)')
  assert((await getChairSubjectData(e1.id, session.id, subA2.id)) === null, 'O7 다른 분과의 대상이면 null')

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
  assert(evaluatorLoginError('MASTER', 0) === null, 'L5 관리자는 진행중 심사 없어도 허용')

  await cleanup()
  console.log(`\n✅ 통합 E2E 통과 — 단언 ${passed}건`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
