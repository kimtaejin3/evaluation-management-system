import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin1234', 10)
  // 마스터
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'MASTER' },
    create: { username: 'admin', passwordHash, name: '관리자', role: 'MASTER' },
  })
  // 간사
  const gansaPw = await bcrypt.hash('gansa1234', 10)
  const gansa = await prisma.user.upsert({
    where: { username: 'gansa' },
    update: { role: 'SECRETARY' },
    create: { username: 'gansa', passwordHash: gansaPw, name: '간사', role: 'SECRETARY', tempPassword: 'gansa1234' },
  })
  // 샘플 과제 + 간사 배정
  const existing = await prisma.project.findFirst({ where: { name: '샘플 과제' } })
  if (!existing) {
    await prisma.project.create({
      data: { name: '샘플 과제', description: '시드 샘플', secretaries: { connect: { id: gansa.id } } },
    })
  }
  console.log('Seeded: 마스터(admin/admin1234), 간사(gansa/gansa1234), 샘플 과제')
}

main().finally(() => prisma.$disconnect())
