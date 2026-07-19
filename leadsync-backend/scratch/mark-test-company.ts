import { prisma } from "../src/lib/prisma";

const botUsername = "fucknikil_bot"; // set this before running

async function main() {
  const before = await prisma.company.findFirst({ where: { telegramBotUsername: botUsername } });
  if (!before) throw new Error("No company found with that bot username — check spelling.");
  const after = await prisma.company.update({
    where: { id: before.id },
    data: { isTest: true }
  });
  console.log("BEFORE:", before);
  console.log("AFTER:", after);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
