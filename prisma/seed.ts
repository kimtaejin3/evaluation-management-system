import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin1234', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, name: '관리자', role: 'ADMIN' },
  })
  // 간사(전 심사 조회 권한)
  const gansaHash = await bcrypt.hash('gansa1234', 10)
  await prisma.user.upsert({
    where: { username: 'gansa' },
    update: { role: 'SECRETARY' },
    create: { username: 'gansa', passwordHash: gansaHash, name: '간사', role: 'SECRETARY' },
  })
  console.log('Seeded admin (admin / admin1234), 간사 (gansa / gansa1234)')
}

main().finally(() => prisma.$disconnect())
