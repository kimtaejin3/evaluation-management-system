import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { saveUpload } from '../lib/storage'

const prisma = new PrismaClient()

const COMPANY_NAMES = [
  '삼성전자',
  '네이버',
  '카카오',
  '현대자동차',
  'SK하이닉스',
  'LG화학',
  '포스코',
  '한화',
]

async function main() {
  await prisma.evaluationSession.deleteMany({ where: { name: { in: ['2026 상반기 사업 평가', '2026 신규 과제 심사'] } } })
  await prisma.user.deleteMany({ where: { username: { in: ['kim', 'lee', 'park'] } } })
  await prisma.company.deleteMany({ where: { name: { in: COMPANY_NAMES } } })

  const pw = await bcrypt.hash('eval1234', 10)
  const kim = await prisma.user.create({ data: { username: 'kim', name: '김평가', role: 'EVALUATOR', passwordHash: pw, tempPassword: 'eval1234' } })
  const lee = await prisma.user.create({ data: { username: 'lee', name: '이심사', role: 'EVALUATOR', passwordHash: pw, tempPassword: 'eval1234' } })
  await prisma.user.create({ data: { username: 'park', name: '박위원', role: 'EVALUATOR', passwordHash: pw, tempPassword: 'eval1234' } })

  // 진행중 회차 (점수 포함)
  const s1 = await prisma.evaluationSession.create({
    data: {
      name: '2026 상반기 사업 평가', description: '상반기 신규 사업 지원 대상 평가', location: '본관 대회의실',
      eventDate: new Date('2026-06-20T14:00:00'), status: 'IN_PROGRESS',
    },
  })
  const c1 = await prisma.criterion.create({ data: { sessionId: s1.id, name: '사업 타당성', description: '시장 규모·성장성 및 수익모델의 타당성', type: 'QUANTITATIVE', maxScore: 40, weight: 1, order: 0 } })
  const c2 = await prisma.criterion.create({ data: { sessionId: s1.id, name: '추진 역량', description: '조직·인력 구성과 실행 계획의 구체성', type: 'QUANTITATIVE', maxScore: 30, weight: 1, order: 1 } })
  // 정성 항목: 등급(답) 옵션 정의
  const GRADE_OPTS = [
    { label: '매우 우수', points: 30 },
    { label: '우수', points: 24 },
    { label: '보통', points: 18 },
    { label: '미흡', points: 12 },
    { label: '매우 미흡', points: 6 },
  ]
  const gradeIdx: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 }
  const c3 = await prisma.criterion.create({ data: { sessionId: s1.id, name: '발표 평가', description: '발표 전달력·질의응답 충실도', type: 'QUALITATIVE', maxScore: 30, weight: 1, order: 2, gradeOptions: GRADE_OPTS } })
  const names = COMPANY_NAMES
  // 전역 기업 등록(회차에 묶이지 않음)
  const companies: Record<string, { id: string }> = {}
  for (const n of names) {
    companies[n] = await prisma.company.create({ data: { name: n, description: `${n} 사업 지원 신청` } })
  }
  // 기업 자료 — 첫 기업에 이 회차(s1) 전용 + 공통 샘플 문서 (storage 어댑터: Blob/로컬)
  const docBody = `${names[0]} 사업계획서 (데모 파일)\n시장성·실현 가능성 등 검토 자료\n`
  const commonBody = `${names[0]} 회사소개서 (공통 데모 파일)\n`
  const planName = `${names[0]}_사업계획서_2026상반기.txt`
  const introName = `${names[0]}_회사소개서_공통.txt`
  const planSaved = await saveUpload(new File([docBody], planName, { type: 'text/plain' }))
  const introSaved = await saveUpload(new File([commonBody], introName, { type: 'text/plain' }))
  await prisma.document.create({
    data: {
      companyId: companies[names[0]].id,
      sessionId: s1.id,
      originalName: planName,
      storedName: planSaved.storedName,
      url: planSaved.url,
      mimeType: 'text/plain',
      size: Buffer.byteLength(docBody),
    },
  })
  await prisma.document.create({
    data: {
      companyId: companies[names[0]].id,
      sessionId: null,
      originalName: introName,
      storedName: introSaved.storedName,
      url: introSaved.url,
      mimeType: 'text/plain',
      size: Buffer.byteLength(commonBody),
    },
  })

  // 회차에 기업 편입(평가 대상)
  const subs = await Promise.all(names.map((n, i) => prisma.subject.create({ data: { sessionId: s1.id, companyId: companies[n].id, name: n, order: i } })))
  await prisma.assignment.createMany({ data: [{ sessionId: s1.id, userId: kim.id }, { sessionId: s1.id, userId: lee.id }] })

  // 모니터링이 완료/입력중/미평가를 두루 보여주도록 위원별 진행 상태를 섞음
  type Mode = 'done' | 'partial' | 'none'
  // leeBias: 이심사 점수에 적용할 편차(기본 -2, 큰 값이면 위원 간 이견 시연)
  // 기업 순서(names)와 동일한 인덱스로 매핑
  const plan: { kim: Mode; lee: Mode; q1: number; q2: number; g: string; leeBias?: number }[] = [
    { kim: 'done', lee: 'done', q1: 36, q2: 27, g: 'A' },
    { kim: 'done', lee: 'done', q1: 30, q2: 24, g: 'B', leeBias: -13 },
    { kim: 'done', lee: 'done', q1: 33, q2: 21, g: 'A' },
    { kim: 'done', lee: 'partial', q1: 34, q2: 26, g: 'A' },
    { kim: 'partial', lee: 'none', q1: 28, q2: 22, g: 'B' },
    { kim: 'none', lee: 'none', q1: 0, q2: 0, g: 'C' },
    { kim: 'done', lee: 'done', q1: 31, q2: 25, g: 'A' },
    { kim: 'none', lee: 'partial', q1: 26, q2: 20, g: 'B' },
  ]
  for (const [i, sub] of subs.entries()) {
    const p = plan[i]
    for (const ev of [kim, lee]) {
      const mode = ev.id === kim.id ? p.kim : p.lee
      const jitter = ev.id === lee.id ? (p.leeBias ?? -2) : 0
      const mk = (criterionId: string, value: number, grade: string | null) =>
        prisma.score.create({ data: { sessionId: s1.id, evaluatorId: ev.id, subjectId: sub.id, criterionId, value, grade } })
      if (mode === 'done') {
        await mk(c1.id, p.q1 + jitter, null)
        await mk(c2.id, p.q2 + jitter, null)
        const opt = GRADE_OPTS[gradeIdx[p.g] ?? 2]
        await mk(c3.id, opt.points, opt.label)
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
