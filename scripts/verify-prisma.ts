import 'dotenv/config'
import { prisma } from '../lib/db'
async function main() {
  const users = await prisma.user.count()
  const sessions = await prisma.evaluationSession.count()
  const admin = await prisma.user.findFirst({ where: { username: 'admin' }, select: { username: true, role: true } })
  console.log('✅ Connected — users:', users, '| sessions:', sessions, '| admin:', admin?.username, admin?.role)
}
main().catch((e) => { console.error('❌ 연결/쿼리 실패:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
