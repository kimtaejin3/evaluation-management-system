import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { saveUpload } from '../lib/storage'

const prisma = new PrismaClient()

// 의존성 없이 멀티페이지 PDF를 생성 — 평가위원 화면에서 PDF·여러 페이지 열람 테스트용
function buildPdf(pages: string[]): Buffer {
  const objs: string[] = []
  const kids: number[] = []
  let n = 4 // 1=Catalog, 2=Pages, 3=Font
  const pageObjs: { contentNo: number; pageNo: number; text: string }[] = []
  for (const text of pages) {
    const contentNo = n++
    const pageNo = n++
    pageObjs.push({ contentNo, pageNo, text })
    kids.push(pageNo)
  }
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`
  objs[2] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
  objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`
  for (const p of pageObjs) {
    const stream = `BT /F1 28 Tf 60 740 Td (${p.text}) Tj ET`
    objs[p.contentNo] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    objs[p.pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${p.contentNo} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
  }
  const total = n - 1
  let body = `%PDF-1.4\n`
  const offsets: number[] = []
  for (let i = 1; i <= total; i++) {
    offsets[i] = Buffer.byteLength(body)
    body += `${i} 0 obj\n${objs[i]}\nendobj\n`
  }
  const xrefStart = Buffer.byteLength(body)
  body += `xref\n0 ${total + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= total; i++) body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(body, 'latin1')
}

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

  // 간사 + 과제(데모 분과를 이 과제 아래 배치)
  const gansa = await prisma.user.upsert({
    where: { username: 'gansa' },
    update: { role: 'SECRETARY' },
    create: { username: 'gansa', name: '간사', role: 'SECRETARY', passwordHash: await bcrypt.hash('gansa1234', 10), tempPassword: 'gansa1234' },
  })
  const project = await prisma.project.create({
    data: { name: '2026 데모 과제', description: '데모 시드 과제', secretaries: { connect: { id: gansa.id } } },
  })

  // 진행중 회차 (점수 포함)
  const s1 = await prisma.evaluationSession.create({
    data: {
      name: '2026 상반기 사업 평가', description: '상반기 신규 사업 지원 대상 평가', location: '본관 대회의실',
      eventDate: new Date('2026-06-20T14:00:00'), status: 'IN_PROGRESS',
      projectId: project.id, secretaryId: gansa.id,
    },
  })
  const c1 = await prisma.criterion.create({ data: { sessionId: s1.id, section: '사업계획', name: '사업 타당성', description: '시장 규모·성장성 및 수익모델의 타당성', type: 'QUANTITATIVE', maxScore: 40, weight: 1, order: 0 } })
  const c2 = await prisma.criterion.create({ data: { sessionId: s1.id, section: '추진역량', name: '추진 역량', description: '조직·인력 구성과 실행 계획의 구체성', type: 'QUANTITATIVE', maxScore: 30, weight: 1, order: 1 } })
  // 정성 항목: 등급(답) 옵션 정의
  const GRADE_OPTS = [
    { label: '매우 우수', points: 30 },
    { label: '우수', points: 24 },
    { label: '보통', points: 18 },
    { label: '미흡', points: 12 },
    { label: '매우 미흡', points: 6 },
  ]
  const gradeIdx: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 }
  const c3 = await prisma.criterion.create({ data: { sessionId: s1.id, section: '기대효과', name: '발표 평가', description: '발표 전달력·질의응답 충실도', type: 'QUALITATIVE', maxScore: 30, weight: 1, order: 2, gradeOptions: GRADE_OPTS } })
  const names = COMPANY_NAMES
  // 전역 기업 등록(회차에 묶이지 않음)
  const companies: Record<string, { id: string }> = {}
  for (const n of names) {
    companies[n] = await prisma.company.create({ data: { name: n, description: `${n} 사업 지원 신청` } })
  }
  // 기업 자료 — 회차(s1) 전용 + 공통 샘플 문서 (storage 어댑터: Blob/로컬)
  // 평가위원 화면의 다중 프리뷰 테스트를 위해 앞 기업 몇 곳에 여러 종류의 서류를 넣음
  const makeDoc = async (companyName: string, fileName: string, body: string, sessionId: string | null) => {
    const saved = await saveUpload(new File([body], fileName, { type: 'text/plain' }))
    await prisma.document.create({
      data: {
        companyId: companies[companyName].id,
        sessionId,
        originalName: fileName,
        storedName: saved.storedName,
        url: saved.url,
        mimeType: 'text/plain',
        size: Buffer.byteLength(body),
      },
    })
  }

  // 회차 전용 서류 세트(사업계획서·현장실태조사서·사전검토표)를 앞 3개 기업에 부여
  for (const cn of names.slice(0, 3)) {
    await makeDoc(cn, `${cn}_사업계획서_2026상반기.txt`,
      `${cn} 사업계획서 (데모 파일)\n\n1. 사업 개요\n   - 시장 규모와 성장성, 수익모델의 타당성\n2. 추진 전략\n   - 단계별 실행 계획 및 일정\n3. 기대 효과\n   - 매출·고용 창출 등 정량 효과\n`, s1.id)
    await makeDoc(cn, `${cn}_현장실태조사서_2026상반기.txt`,
      `${cn} 현장실태 조사서 (데모 파일)\n\n- 조사일자: 2026-06-10\n- 사업장 위치 및 시설 현황\n- 인력 운영 실태\n- 특이사항: 없음\n`, s1.id)
    await makeDoc(cn, `${cn}_사전검토표_2026상반기.txt`,
      `${cn} 사전검토표 (데모 파일)\n\n[ 적격 여부 ] 적격\n[ 제출 서류 ] 사업계획서, 재무제표, 사업자등록증 — 모두 제출\n[ 검토자 의견 ] 형식 요건 충족, 본심사 대상 적합\n`, s1.id)
  }
  // 공통(전 회차) 서류 — 첫 기업 회사소개서
  await makeDoc(names[0], `${names[0]}_회사소개서_공통.txt`,
    `${names[0]} 회사소개서 (공통 데모 파일)\n\n- 설립연도 및 연혁\n- 주요 사업 분야\n- 조직 및 주요 실적\n`, null)

  // 멀티페이지 PDF 샘플 — PDF·여러 페이지 열람 테스트용 (첫 기업, 이 회차)
  const pdf = buildPdf(['Page 1 - Business Plan', 'Page 2 - Field Survey', 'Page 3 - Review Sheet'])
  const pdfName = `${names[0]}_종합심사자료_3페이지.pdf`
  const pdfSaved = await saveUpload(new File([new Uint8Array(pdf)], pdfName, { type: 'application/pdf' }))
  await prisma.document.create({
    data: { companyId: companies[names[0]].id, sessionId: s1.id, originalName: pdfName, storedName: pdfSaved.storedName, url: pdfSaved.url, mimeType: 'application/pdf', size: pdf.length },
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
    data: { name: '2026 신규 과제 심사', description: '하반기 과제 공모', location: '미정', status: 'DRAFT', projectId: project.id, secretaryId: gansa.id },
  })

  console.log('데모 데이터 생성 완료. (마스터 admin/admin1234 · 간사 gansa/gansa1234 · 평가위원 kim/lee/park pw eval1234)')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
