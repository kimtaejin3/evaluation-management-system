import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { gradeToValue } from '../lib/scoring'

const prisma = new PrismaClient()

async function main() {
  await prisma.evaluationSession.deleteMany({ where: { name: { in: ['2026 상반기 사업 평가', '2026 신규 과제 심사'] } } })
  await prisma.user.deleteMany({ where: { username: { in: ['kim', 'lee', 'park'] } } })

  const pw = await bcrypt.hash('eval1234', 10)
  const kim = await prisma.user.create({ data: { username: 'kim', name: '김평가', role: 'EVALUATOR', passwordHash: pw } })
  const lee = await prisma.user.create({ data: { username: 'lee', name: '이심사', role: 'EVALUATOR', passwordHash: pw } })
  await prisma.user.create({ data: { username: 'park', name: '박위원', role: 'EVALUATOR', passwordHash: pw } })

  // 진행중 회차 (점수 포함)
  const s1 = await prisma.evaluationSession.create({
    data: {
      name: '2026 상반기 사업 평가', description: '상반기 신규 사업 지원 대상 평가', location: '본관 대회의실',
      eventDate: new Date('2026-06-20T14:00:00'), status: 'IN_PROGRESS',
    },
  })
  const c1 = await prisma.criterion.create({ data: { sessionId: s1.id, name: '사업 타당성', description: '시장성·실현 가능성', type: 'QUANTITATIVE', maxScore: 40, weight: 1, order: 0 } })
  const c2 = await prisma.criterion.create({ data: { sessionId: s1.id, name: '추진 역량', description: '조직·인력 역량', type: 'QUANTITATIVE', maxScore: 30, weight: 1, order: 1 } })
  const c3 = await prisma.criterion.create({ data: { sessionId: s1.id, name: '발표 평가', description: '전달력·이해도', type: 'QUALITATIVE', maxScore: 30, weight: 1, order: 2 } })
  const names = ['A기업', 'B기업', 'C기업', 'D기업', 'E기업', 'F기업', 'G기업', 'H기업']
  const subs = await Promise.all(names.map((n, i) => prisma.subject.create({ data: { sessionId: s1.id, name: n, order: i } })))
  await prisma.assignment.createMany({ data: [{ sessionId: s1.id, userId: kim.id }, { sessionId: s1.id, userId: lee.id }] })

  // 모니터링이 완료/입력중/미평가를 두루 보여주도록 위원별 진행 상태를 섞음
  type Mode = 'done' | 'partial' | 'none'
  const plan: Record<string, { kim: Mode; lee: Mode; q1: number; q2: number; g: string }> = {
    A기업: { kim: 'done', lee: 'done', q1: 36, q2: 27, g: 'A' },
    B기업: { kim: 'done', lee: 'done', q1: 30, q2: 24, g: 'B' },
    C기업: { kim: 'done', lee: 'done', q1: 33, q2: 21, g: 'A' },
    D기업: { kim: 'done', lee: 'partial', q1: 34, q2: 26, g: 'A' },
    E기업: { kim: 'partial', lee: 'none', q1: 28, q2: 22, g: 'B' },
    F기업: { kim: 'none', lee: 'none', q1: 0, q2: 0, g: 'C' },
    G기업: { kim: 'done', lee: 'done', q1: 31, q2: 25, g: 'A' },
    H기업: { kim: 'none', lee: 'partial', q1: 26, q2: 20, g: 'B' },
  }
  for (const sub of subs) {
    const p = plan[sub.name]
    for (const ev of [kim, lee]) {
      const mode = ev.id === kim.id ? p.kim : p.lee
      const jitter = ev.id === lee.id ? -2 : 0
      const mk = (criterionId: string, value: number, grade: string | null) =>
        prisma.score.create({ data: { sessionId: s1.id, evaluatorId: ev.id, subjectId: sub.id, criterionId, value, grade } })
      if (mode === 'done') {
        await mk(c1.id, p.q1 + jitter, null)
        await mk(c2.id, p.q2 + jitter, null)
        await mk(c3.id, gradeToValue(p.g, 30), p.g)
      } else if (mode === 'partial') {
        await mk(c1.id, p.q1 + jitter, null) // 항목 1개만 입력 → 입력중
      }
    }
  }

  // 초안 회차
  await prisma.evaluationSession.create({
    data: { name: '2026 신규 과제 심사', description: '하반기 과제 공모', location: '미정', status: 'DRAFT' },
  })

  console.log('데모 데이터 생성 완료. (평가위원 kim/lee/park · pw eval1234)')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
