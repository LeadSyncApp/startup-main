import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const users = await p.$queryRawUnsafe<any[]>(`SELECT id, email, role, "companyId" FROM "User" LIMIT 5`);
  console.log("USERS:", JSON.stringify(users, null, 2));
  const companies = await p.$queryRawUnsafe<any[]>(`SELECT id, name FROM "Company" LIMIT 3`);
  console.log("COMPANIES:", JSON.stringify(companies, null, 2));
  const orders = await p.$queryRawUnsafe<any[]>(`SELECT id, "companyId", "isDeleted", status FROM "Order" LIMIT 5`);
  console.log("ORDERS:", JSON.stringify(orders, null, 2));
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });