import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Use an existing message to get valid FK IDs
  const msg = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "companyId", "conversationId" FROM "Message" LIMIT 1`
  );
  if (!msg.length) { console.log("No messages"); process.exit(1); }
  const companyId = msg[0].companyId;
  const convId = msg[0].conversationId;

  // CREATE order with ALL DB-level NOT NULL columns provided
  const { randomUUID } = require("crypto");
  const orderId = randomUUID();
  const now = new Date().toISOString();

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Order" (id, "companyId", "conversationId", summary, priority, status, "sourceChannel", "createdAt", "updatedAt", amount, "totalCogs", "netProfit", "approvalStatus", "source", "isDeleted", "isUrgent", "priorityScore", version)
    VALUES ($1, $2, $3, $4, 'NORMAL', 'NEW', 'WEBSITE', $5::timestamp, $5::timestamp, 0, 0, 0, 'APPROVED', 'MANUAL', false, false, 0, 1)
  `, orderId, companyId, convId, "e2e-test-delete", now);

  const before = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "isDeleted" FROM "Order" WHERE id = $1`, orderId
  );
  console.log("CREATED order:", orderId.substring(0, 8) + "...");
  console.log("BEFORE isDeleted:", before[0].isDeleted, "(expected false)");

  // START server
  const expressApp = require("../src/app").default;
  const http = require("http");
  const server = http.createServer(expressApp);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;
  console.log("Server on port", port);

  // GENERATE JWT for OWNER user
  const jwt = require("jsonwebtoken");
  const token = jwt.sign(
    { userId: "2c4e6969-3e03-4229-8e89-734dfa7747c7", email: "learningguy116@gmail.com", role: "OWNER", companyId },
    "super-secret-jwt-key-change-me-in-production",
    { expiresIn: "1h", algorithm: "HS256" }
  );

  // HIT DELETE /api/orders/:id through EXPRESS ROUTE
  const response = await new Promise<any>((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: `/api/orders/${orderId}`, method: "DELETE",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } },
      (res: any) => { let d = ""; res.on("data", (c: string) => d += c); res.on("end", () => resolve({ status: res.statusCode, body: d })); }
    );
    req.on("error", reject);
    req.end();
  });
  console.log("\nDELETE RESPONSE:", response.status, response.body);

  // QUERY row after DELETE
  const after = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "isDeleted" FROM "Order" WHERE id = $1`, orderId
  );
  console.log("AFTER isDeleted:", after[0].isDeleted, "(expected true)");
  console.log("Flipped from false to true:", before[0].isDeleted === false && after[0].isDeleted === true);

  // CLEANUP
  await prisma.$executeRawUnsafe(`DELETE FROM "Order" WHERE id = $1`, orderId);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();

  const pass = before[0].isDeleted === false && after[0].isDeleted === true && response.status === 200;
  console.log("\n" + (pass ? "PASS" : "FAIL"));
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });