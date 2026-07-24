import { PrismaClient } from "@prisma/client";
import { decrementStockForOrder } from "../../src/services/knowledge/inventory.service";

const prisma = new PrismaClient();

async function main() {
  console.log("=== STEP 5 SANITY CHECK STARTED ===");

  // 1. Setup company, product, variant
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        id: "test-company-sanity",
        name: "Test Company Sanity",
        businessType: "RETAIL"
      }
    });
  }

  const companyId = company.id;

  let conversation = await prisma.conversation.findFirst({
    where: { companyId }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        companyId,
        channel: "WHATSAPP",
        mode: "BOT"
      }
    });
  }

  let product = await prisma.inventoryProduct.findFirst({
    where: { companyId, name: "Sanity Check T-Shirt" }
  });

  if (!product) {
    product = await prisma.inventoryProduct.create({
      data: {
        companyId,
        name: "Sanity Check T-Shirt",
        basePrice: 500,
        hasVariants: true,
        sku: "SANITY-TSHIRT"
      }
    });
  }

  let variant = await prisma.inventoryVariant.findFirst({
    where: { productId: product.id, attributeValue: "Size L" }
  });

  if (!variant) {
    variant = await prisma.inventoryVariant.create({
      data: {
        productId: product.id,
        attributeValue: "Size L",
        price: 500,
        stock: 1,
        sku: "SANITY-TSHIRT-L"
      }
    });
  } else {
    // Reset stock to 1 as specified in STEP 5
    variant = await prisma.inventoryVariant.update({
      where: { id: variant.id },
      data: { stock: 1 }
    });
  }

  // Delete existing StockHistory for clean counting
  await prisma.stockHistory.deleteMany({
    where: { variantId: variant.id }
  });

  console.log(`Initial stock for variant ${variant.id}: ${variant.stock}`);

  // Create 10 test orders targeting this variant
  const orders = [];
  for (let i = 0; i < 10; i++) {
    const order = await prisma.order.create({
      data: {
        company: { connect: { id: companyId } },
        conversation: { connect: { id: conversation.id } },
        amount: 500,
        status: "PENDING" as any,
        summary: "Sanity test order",
        source: "MANUAL" as any,
        orderItems: {
          create: [
            {
              company: { connect: { id: companyId } },
              name: product.name,
              quantity: 1,
              price: 500,
              sku: variant.id
            }
          ]
        }
      }
    });
    orders.push(order);
  }

  // 2. Fire 10 concurrent requests using Promise.all
  console.log("Firing 10 concurrent decrementStockForOrder requests...");
  const results = await Promise.allSettled(
    orders.map(order => decrementStockForOrder(order.id, companyId))
  );

  // 3. Gather raw statistics
  const fulfilledCount = results.filter(r => r.status === "fulfilled").length;
  const rejectedCount = results.filter(r => r.status === "rejected").length;

  const finalVariant = await prisma.inventoryVariant.findUnique({
    where: { id: variant.id }
  });

  const stockHistoryRows = await prisma.stockHistory.findMany({
    where: { variantId: variant.id },
    orderBy: { changedAt: "asc" }
  });

  console.log("=== RAW RESULTS ===");
  console.log(`Requests attempted: ${orders.length}`);
  console.log(`Requests fulfilled (no crash): ${fulfilledCount}`);
  console.log(`Requests rejected: ${rejectedCount}`);
  console.log(`Final stock value in DB: ${finalVariant?.stock}`);
  console.log(`StockHistory rows created: ${stockHistoryRows.length}`);
  console.log("StockHistory rows detail:", JSON.stringify(stockHistoryRows, null, 2));

  const failures: string[] = [];
  if (finalVariant?.stock !== 0) failures.push(`Expected final stock 0, got ${finalVariant?.stock}`);
  if (stockHistoryRows.length !== 1) failures.push(`Expected exactly 1 StockHistory row, got ${stockHistoryRows.length}`);
  if (stockHistoryRows[0] && (stockHistoryRows[0].oldStock !== 1 || stockHistoryRows[0].newStock !== 0)) {
    failures.push(`Expected StockHistory row oldStock=1,newStock=0, got oldStock=${stockHistoryRows[0].oldStock},newStock=${stockHistoryRows[0].newStock}`);
  }

  // Clean up created test orders
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: orders.map(o => o.id) } }
  });
  await prisma.order.deleteMany({
    where: { id: { in: orders.map(o => o.id) } }
  });

  if (failures.length > 0) {
    console.error("=== TEST FAILED ===");
    failures.forEach(f => console.error(" - " + f));
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("=== TEST PASSED ===");
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Sanity check script error:", err);
  prisma.$disconnect();
  process.exit(1);
});
