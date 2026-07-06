import { PrismaClient } from '@prisma/client'

// 기존 데이터 백필: 전 항목 입력 완료된 (위원, 대상)을 APPROVED로 생성(현재 결과 유지).
async function main() {
  const prisma = new PrismaClient()
  const sessions = await prisma.evaluationSession.findMany({ select: { id: true } })
  let created = 0
  for (const { id: sessionId } of sessions) {
    const [criteria, assignments, scores] = await Promise.all([
      prisma.criterion.findMany({ where: { sessionId }, select: { id: true } }),
      prisma.assignment.findMany({ where: { sessionId }, select: { userId: true } }),
      prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true } }),
    ])
    const total = criteria.length
    if (total === 0) continue
    const subjectIds = [...new Set(scores.map((s) => s.subjectId))]
    const countBy = new Map<string, number>()
    for (const s of scores) {
      const k = `${s.evaluatorId}:${s.subjectId}`
      countBy.set(k, (countBy.get(k) ?? 0) + 1)
    }
    for (const a of assignments) {
      for (const subjectId of subjectIds) {
        const filled = countBy.get(`${a.userId}:${subjectId}`) ?? 0
        if (filled < total) continue
        const existing = await prisma.submission.findUnique({
          where: { evaluatorId_subjectId: { evaluatorId: a.userId, subjectId } },
        })
        if (existing) continue
        await prisma.submission.create({
          data: {
            sessionId,
            evaluatorId: a.userId,
            subjectId,
            status: 'APPROVED',
            submittedAt: new Date(),
            decidedAt: new Date(),
          },
        })
        created++
      }
    }
  }
  console.log(`backfilled ${created} APPROVED submissions`)
  await prisma.$disconnect()
}
main()
