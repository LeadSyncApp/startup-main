import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe('SELECT DISTINCT role, COUNT(*)::int as count FROM "User" GROUP BY role ORDER BY role');
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
})();