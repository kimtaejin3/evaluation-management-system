import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { computeFinalScores, rankSubjects, gradeToValue } from '../lib/scoring'

const prisma = new PrismaClient()

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  console.log('  ✓ ' + msg)
}

async function main() {
  // cleanup prior run
  await prisma.evaluationSession.deleteMany({ where: { name: 'E2E 테스트 회차' } })
  await prisma.user.deleteMany({ where: { username: { in: ['e2e_eval1', 'e2e_eval2'] } } })

  console.log('1) 회차 생성 + 항목/대상/위원')
  const session = await prisma.evaluationSession.create({ data: { name: 'E2E 테스트 회차' } })
  const cQuant = await prisma.criterion.create({ data: { sessionId: session.id, name: '정량항목', type: 'QUANTITATIVE', maxScore: 10, weight: 2, order: 0 } })
  const cQual = await prisma.criterion.create({ data: { sessionId: session.id, name: '정성항목', type: 'QUALITATIVE', maxScore: 10, weight: 1, order: 1 } })
  const subA = await prisma.subject.create({ data: { sessionId: session.id, name: '대상 A', order: 0 } })
  const subB = await prisma.subject.create({ data: { sessionId: session.id, name: '대상 B', order: 1 } })
  const hash = await bcrypt.hash('pw', 10)
  const e1 = await prisma.user.create({ data: { username: 'e2e_eval1', name: '위원1', role: 'EVALUATOR', passwordHash: hash } })
  const e2 = await prisma.user.create({ data: { username: 'e2e_eval2', name: '위원2', role: 'EVALUATOR', passwordHash: hash } })
  await prisma.assignment.createMany({ data: [
    { sessionId: session.id, userId: e1.id },
    { sessionId: session.id, userId: e2.id },
  ] })
  assert(true, '생성 완료')

  console.log('2) 평가 시작 + 점수 입력')
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { status: 'IN_PROGRESS' } })
  // 대상 A: 위원1 quant=8 qual=A(=10), 위원2 quant=6 qual=B(=8)
  // 대상 B: 위원1 quant=4 qual=C(=6), 위원2 quant=2 qual=D(=4)
  const inputs = [
    { ev: e1.id, sub: subA.id, cr: cQuant.id, value: 8, grade: null },
    { ev: e1.id, sub: subA.id, cr: cQual.id, value: gradeToValue('A', 10), grade: 'A' },
    { ev: e2.id, sub: subA.id, cr: cQuant.id, value: 6, grade: null },
    { ev: e2.id, sub: subA.id, cr: cQual.id, value: gradeToValue('B', 10), grade: 'B' },
    { ev: e1.id, sub: subB.id, cr: cQuant.id, value: 4, grade: null },
    { ev: e1.id, sub: subB.id, cr: cQual.id, value: gradeToValue('C', 10), grade: 'C' },
    { ev: e2.id, sub: subB.id, cr: cQuant.id, value: 2, grade: null },
    { ev: e2.id, sub: subB.id, cr: cQual.id, value: gradeToValue('D', 10), grade: 'D' },
  ]
  for (const i of inputs) {
    await prisma.score.create({ data: { sessionId: session.id, evaluatorId: i.ev, subjectId: i.sub, criterionId: i.cr, value: i.value, grade: i.grade } })
  }
  assert(true, '8건 점수 입력')

  console.log('3) 집계 검증')
  const scores = await prisma.score.findMany({ where: { sessionId: session.id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: session.id } })
  const finals = computeFinalScores(
    scores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })),
    criteria.map((c) => ({ id: c.id, weight: c.weight })),
  )
  // 대상A: 위원1 = 8*2 + 10*1 = 26 ; 위원2 = 6*2 + 8*1 = 20 ; 평균 = 23
  // 대상B: 위원1 = 4*2 + 6*1 = 14 ; 위원2 = 2*2 + 4*1 = 8 ; 평균 = 11
  assert(finals.get(subA.id) === 23, `대상 A 최종 = 23 (실제 ${finals.get(subA.id)})`)
  assert(finals.get(subB.id) === 11, `대상 B 최종 = 11 (실제 ${finals.get(subB.id)})`)
  const ranked = rankSubjects(finals)
  assert(ranked[0].subjectId === subA.id && ranked[0].rank === 1, '대상 A가 1위')
  assert(ranked[1].subjectId === subB.id && ranked[1].rank === 2, '대상 B가 2위')

  console.log('4) 마감·잠금')
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { status: 'CLOSED' } })
  const closed = await prisma.evaluationSession.findUnique({ where: { id: session.id } })
  assert(closed?.status === 'CLOSED', '회차 CLOSED 상태')

  console.log('\n데이터-플로우 E2E 통과. (세션 id=' + session.id + ')')
  // print session id for the HTTP test
  console.log('SESSION_ID=' + session.id)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
