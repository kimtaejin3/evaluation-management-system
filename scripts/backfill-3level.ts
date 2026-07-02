import { prisma } from '../lib/db'

async function main() {
  const sessions = await prisma.evaluationSession.findMany({ select: { id: true } })
  let migrated = 0
  for (const { id: sessionId } of sessions) {
    const criteria = await prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
    if (criteria.length === 0) continue
    if (criteria.every((c) => c.subitemId)) continue // 이미 이관됨(멱등)

    // section 최초 등장 순서로 평가항목(그룹) 생성
    const sectionOrder: string[] = []
    for (const c of criteria) {
      const key = c.section ?? '기타'
      if (!sectionOrder.includes(key)) sectionOrder.push(key)
    }
    const groupIdByKey = new Map<string, string>()
    for (let i = 0; i < sectionOrder.length; i++) {
      const key = sectionOrder[i]
      const g = await prisma.criterionGroup.create({ data: { sessionId, name: key, order: i, maxScore: 0 } })
      groupIdByKey.set(key, g.id)
    }

    // 기존 Criterion 각각 → 세부항목 1개 + 리프 연결(name = description ?? name)
    const subCountByGroup = new Map<string, number>()
    for (const c of criteria) {
      if (c.subitemId) continue
      const key = c.section ?? '기타'
      const groupId = groupIdByKey.get(key)!
      const so = subCountByGroup.get(groupId) ?? 0
      const sub = await prisma.criterionSubitem.create({ data: { groupId, name: c.name, order: so } })
      subCountByGroup.set(groupId, so + 1)
      await prisma.criterion.update({ where: { id: c.id }, data: { subitemId: sub.id, name: c.description ?? c.name } })
    }

    // 평가항목 목표배점 = 하위 배점 합
    for (const [key, groupId] of groupIdByKey) {
      const sum = criteria.filter((c) => (c.section ?? '기타') === key).reduce((a, c) => a + c.maxScore, 0)
      await prisma.criterionGroup.update({ where: { id: groupId }, data: { maxScore: sum } })
    }
    migrated++
  }
  console.log(`backfill done: ${migrated} sessions migrated`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
