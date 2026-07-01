import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin1234', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, name: '관리자', role: 'MASTER' },
  })
  console.log('Seeded admin (admin / admin1234)')
}

main().finally(() => prisma.$disconnect())
