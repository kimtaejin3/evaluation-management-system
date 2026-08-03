import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 시연용 완결 시드 — 관리자/담당자/평가위원 계정 + 평가위원장 지정 + 평가항목 + 평가 대상까지
// 한 벌 구성해, 로그인 직후 전체 흐름(배정→평가→위원장 종합의견→집계)을 시연할 수 있게 한다.
// 모든 upsert/guard는 멱등 — 여러 번 실행해도 중복이 생기지 않는다.
async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10)

  // ── 계정 ──
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'MASTER', name: '관리자' },
    create: { username: 'admin', passwordHash: await hash('admin1234'), name: '관리자', role: 'MASTER' },
  })

  // 담당자(구 간사)
  const secretary = await prisma.user.upsert({
    where: { username: 'gansa' },
    update: { role: 'SECRETARY', name: '김담당자', tempPassword: 'gansa1234' },
    create: { username: 'gansa', passwordHash: await hash('gansa1234'), name: '김담당자', role: 'SECRETARY', tempPassword: 'gansa1234' },
  })

  // 평가위원 3명 — 데모 로그인·위원장 지정 시연에 필요
  const evaluatorSpecs = [
    { username: 'wiwon1', name: '이평가', pw: 'wiwon1234' },
    { username: 'wiwon2', name: '박심사', pw: 'wiwon1234' },
    { username: 'wiwon3', name: '최위원', pw: 'wiwon1234' },
  ]
  const evaluators = []
  for (const e of evaluatorSpecs) {
    evaluators.push(
      await prisma.user.upsert({
        where: { username: e.username },
        update: { role: 'EVALUATOR', name: e.name, tempPassword: e.pw },
        create: { username: e.username, passwordHash: await hash(e.pw), name: e.name, role: 'EVALUATOR', tempPassword: e.pw },
      }),
    )
  }

  // ── 시연 사업 + 분과 ──
  let project = await prisma.project.findFirst({ where: { name: '시연 사업' } })
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: '시연 사업',
        description: '전체 흐름 시연용 샘플 사업',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-12-31'),
        secretaries: { connect: { id: secretary.id } },
      },
    })
  } else {
    await prisma.project.update({ where: { id: project.id }, data: { secretaries: { connect: { id: secretary.id } } } })
  }

  let session = await prisma.evaluationSession.findFirst({ where: { projectId: project.id, name: '시연 분과' } })
  if (!session) {
    session = await prisma.evaluationSession.create({
      data: { name: '시연 분과', projectId: project.id, status: 'IN_PROGRESS', secretaryId: secretary.id },
    })
  } else {
    await prisma.evaluationSession.update({ where: { id: session.id }, data: { status: 'IN_PROGRESS', secretaryId: secretary.id } })
  }

  // ── 평가위원 배정(승인) + 위원장 지정(첫 위원) ──
  for (const ev of evaluators) {
    await prisma.assignment.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: ev.id } },
      update: { status: 'APPROVED' },
      create: { sessionId: session.id, userId: ev.id, status: 'APPROVED', createdById: admin.id },
    })
  }
  await prisma.evaluationSession.update({ where: { id: session.id }, data: { chairId: evaluators[0].id } })

  // ── 평가항목(과제 공통): 사업계획(40) / 추진역량(30) / 기대효과(30) ──
  const groupSpecs = [
    { name: '사업계획', max: 40, subs: [{ name: '목표 및 내용', max: 25 }, { name: '추진 체계', max: 15 }] },
    { name: '추진역량', max: 30, subs: [{ name: '연구진 역량', max: 30 }] },
    { name: '기대효과', max: 30, subs: [{ name: '사업화 가능성', max: 20 }, { name: '파급효과', max: 10 }] },
  ]
  const existingGroups = await prisma.criterionGroup.count({ where: { projectId: project.id } })
  if (existingGroups === 0) {
    let gOrder = 0
    for (const g of groupSpecs) {
      const group = await prisma.criterionGroup.create({ data: { projectId: project.id, name: g.name, maxScore: g.max, order: gOrder++ } })
      let sOrder = 0
      for (const sub of g.subs) {
        const subitem = await prisma.criterionSubitem.create({ data: { groupId: group.id, name: sub.name, maxScore: sub.max, order: sOrder++ } })
        // 지표별 모드: 세부항목당 지표 1개(배점 = 세부항목 만점)
        await prisma.criterion.create({
          data: { projectId: project.id, subitemId: subitem.id, name: sub.name, maxScore: sub.max, weight: 1, order: sOrder },
        })
      }
    }
  }

  // ── 평가 대상(기업) 2곳 편입 ──
  const companySpecs = [
    { name: '시연기업 A', region: '서울', leadResearcher: '홍길동' },
    { name: '시연기업 B', region: '부산', leadResearcher: '김연구' },
  ]
  let subOrder = 0
  for (const c of companySpecs) {
    const company = await prisma.company.upsert({
      where: { name: c.name },
      update: { region: c.region, leadResearcher: c.leadResearcher },
      create: { name: c.name, region: c.region, leadResearcher: c.leadResearcher },
    })
    await prisma.subject.upsert({
      where: { sessionId_companyId: { sessionId: session.id, companyId: company.id } },
      update: {},
      create: { sessionId: session.id, companyId: company.id, name: company.name, order: subOrder++, status: 'APPROVED' },
    })
  }

  console.log('Seeded 시연 데이터:')
  console.log('  관리자    admin / admin1234')
  console.log('  담당자    gansa / gansa1234')
  console.log('  평가위원  wiwon1~3 / wiwon1234 (wiwon1 = 위원장)')
  console.log('  사업 "시연 사업" · 분과 "시연 분과"(진행중) · 위원 3명 배정 · 평가항목 3그룹 · 대상 2곳')
}

main().finally(() => prisma.$disconnect())
