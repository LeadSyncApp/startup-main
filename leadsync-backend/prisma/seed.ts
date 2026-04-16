import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding LeadSync demo data...')

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('❌ TELEGRAM_BOT_TOKEN missing in .env')
  }

  const passwordHash = await bcrypt.hash('123456', 10)

  /* -------------------- Company: Urban Retail -------------------- */
  let retailCompany = await prisma.company.findFirst({
    where: { name: 'Urban Retail Store' },
  })

  if (!retailCompany) {
    retailCompany = await prisma.company.create({
      data: {
        name: 'Urban Retail Store',
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      },
    })
  } else if (!retailCompany.telegramBotToken) {
    retailCompany = await prisma.company.update({
      where: { id: retailCompany.id },
      data: {
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      },
    })
  }

  /* -------------------- Company: QuickBite -------------------- */
  let foodCompany = await prisma.company.findFirst({
    where: { name: 'QuickBite Food Co.' },
  })

  if (!foodCompany) {
    foodCompany = await prisma.company.create({
      data: { name: 'QuickBite Food Co.' },
    })
  }

  /* -------------------- Users -------------------- */

  await prisma.user.upsert({
    where: {
      email_companyId: {
        email: 'amit@urbanretail.com',
        companyId: retailCompany.id,
      },
    },
    update: {},
    create: {
      name: 'Amit Sharma',
      email: 'amit@urbanretail.com',
      passwordHash,
      role: 'AGENT', // ✅ correct
      company: {
        connect: { id: retailCompany.id },
      },
    },
  })

  await prisma.user.upsert({
    where: {
      email_companyId: {
        email: 'sneha@quickbite.com',
        companyId: foodCompany.id,
      },
    },
    update: {},
    create: {
      name: 'Sneha Patel',
      email: 'sneha@quickbite.com',
      passwordHash,
      role: 'AGENT', // ✅ correct
      company: {
        connect: { id: foodCompany.id },
      },
    },
  })

  console.log('✅ Seeding completed successfully')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
