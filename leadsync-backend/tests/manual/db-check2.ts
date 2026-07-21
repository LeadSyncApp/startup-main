import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres.ahgjtkmjgnjiwfqztmxh:leadsyncnew%40gmail.com%24%24@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require" } },
});
p.$connect()
  .then(() => { console.log("DIRECT DB OK"); return p.$disconnect(); })
  .catch((e: any) => { console.log("DIRECT DB FAIL:", e.message); process.exit(1); });
