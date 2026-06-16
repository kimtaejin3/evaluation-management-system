import { PrismaClient } from '@prisma/client'
import { getCriteriaTemplate } from '../lib/criteria-templates'
const prisma = new PrismaClient()

async function applyToSession(sessionName: string, key: string) {
  const tpl = getCriteriaTemplate(key)
  if (!tpl) throw new Error('no template ' + key)
  const s = await prisma.evaluationSession.findFirst({ where: { name: sessionName } })
  if (!s) { console.log(`[skip] 세션 없음: ${sessionName}`); return }
  const scoreCount = await prisma.score.count({ where: { sessionId: s.id } })
  if (scoreCount > 0) { console.log(`[skip] 점수 존재(${scoreCount}) → 덮어쓰지 않음: ${sessionName}`); return }
  await prisma.criterion.deleteMany({ where: { sessionId: s.id } })
  let order = 0
  for (const sec of tpl.sections) {
    for (const it of sec.items) {
      const maxScore = Math.max(...it.grades.map((g) => g.points))
      await prisma.criterion.create({
        data: { sessionId: s.id, section: sec.section, name: it.name, description: it.description ?? null, type: 'QUALITATIVE', maxScore, weight: 1, order: order++, gradeOptions: it.grades },
      })
    }
  }
  const total = tpl.sections.flatMap((x) => x.items).reduce((a, it) => a + Math.max(...it.grades.map((g) => g.points)), 0)
  console.log(`[ok] ${sessionName}: ${order}개 세부항목 생성, 배점 합계 ${total}`)
}

async function main() {
  await applyToSession('2026 신규 과제 심사', 'regional-rnd')
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
