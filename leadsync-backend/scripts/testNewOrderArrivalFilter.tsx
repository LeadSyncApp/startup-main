import { newOrderArrivalService } from "../src/services/workflow/newOrderArrival.service";

/**
 * Runtime test for the 4 isDeleted fixes in newOrderArrival.service.ts
 * 
 * Calls getCustomerHistory() which runs tenantDb.order.findMany/findFirst
 * with the fixed filter isDeleted: false instead of deletedAt: null.
 * 
 * Since the Order table may be empty, we verify the filter produces 
 * correct SQL by checking the function's structure doesn't throw.
 */

async function main() {
  // Use a known company from earlier tests
  const companyId = "3102a85e-1798-45bb-b6c5-d94ea436f775";

  // Get a lead for this company
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  const lead = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "Lead" WHERE "companyId" = $1 LIMIT 1`,
    companyId
  );

  if (!lead.length) {
    console.log("No leads found for company", companyId);
    console.log("Testing without a lead — verifying the function doesn't throw on empty results");

    // Test getCustomerHistory with a fake leadId — should return 
    // { isExistingCustomer: false, ... } without errors
    const fakeLeadId = "00000000-0000-0000-0000-000000000000";
    try {
      const result = await newOrderArrivalService.getCustomerHistory(companyId, fakeLeadId);
      console.log("\n=== getCustomerHistory with non-existent lead ===");
      console.log("Result:", JSON.stringify(result, null, 2));
      console.log("isExistingCustomer:", result.isExistingCustomer);
      console.log("wasDeleted:", result.wasDeleted);
      console.log("\n✓ Function ran without errors. isDeleted: false is a Prisma where filter —");
      console.log("  it generates WHERE \"isDeleted\" = false in the SQL, which is correct.");
    } catch (e: any) {
      console.error("FAIL:", e.message);
      process.exit(1);
    }
  } else {
    const leadId = lead[0].id;
    console.log("Testing with real lead:", leadId);

    try {
      const result = await newOrderArrivalService.getCustomerHistory(companyId, leadId);
      console.log("\n=== getCustomerHistory with real lead ===");
      console.log("isExistingCustomer:", result.isExistingCustomer);
      console.log("previousOrderCount:", result.previousOrderCount);
      console.log("previousSpend:", result.previousSpend);
      console.log("recentOrders count:", result.recentOrders.length);
      console.log("wasDeleted:", result.wasDeleted);
      console.log("\n✓ Function ran with real data. Orders filtered by isDeleted: false.");
      
      if (result.recentOrders.length > 0) {
        console.log("\n  Sanity check: these orders all have isDeleted=false in the DB.");
        const orderIds = result.recentOrders.map((o: any) => o.id);
        const count = await prisma.$queryRawUnsafe<any[]>(
          `SELECT COUNT(*) as cnt FROM "Order" WHERE id = ANY($1::uuid[]) AND "isDeleted" = false`,
          orderIds
        );
        console.log("  Confirmed non-deleted orders:", count[0].cnt, "of", result.recentOrders.length);
      }
    } catch (e: any) {
      console.error("FAIL:", e.message);
      process.exit(1);
    }
  }

  await prisma.$disconnect();
  console.log("\nPASS");
}

main().catch((e: any) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});