import { PrismaClient } from "@prisma/client";
import { decrementStockForOrder } from "../../src/services/knowledge/inventory.service";

const prisma = new PrismaClient();

async function main() {
  console.log("=== MULTI-WINNER CONCURRENCY TEST STARTED ===");

  // 1. Setup company, product, variant
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        id: "test-company-multi",
        name: "Test Company Multi",
        businessType: "RETAIL",
        companyCode: "TEST_MULTI"
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
    where: { companyId, name: "Multi-Winner Test T-Shirt" }
  });

  if (!product) {
    product = await prisma.inventoryProduct.create({
      data: {
        companyId,
        name: "Multi-Winner Test T-Shirt",
        basePrice: 500,
        hasVariants: true,
        sku: "MULTI-TSHIRT"
      }
    });
  }

  let variant = await prisma.inventoryVariant.findFirst({
    where: { productId: product.id, attributeValue: "Size XL" }
  });

  if (!variant) {
    variant = await prisma.inventoryVariant.create({
      data: {
        productId: product.id,
        attributeValue: "Size XL",
        price: 500,
        stock: 10,
        sku: "MULTI-TSHIRT-XL"
      }
    });
  } else {
    // Reset stock to 10 as specified
    variant = await prisma.inventoryVariant.update({
      where: { id: variant.id },
      data: { stock: 10 }
    });
  }

  // Delete existing StockHistory for clean counting
  await prisma.stockHistory.deleteMany({
    where: { variantId: variant.id }
  });

  console.log(`Initial stock for variant ${variant.id}: ${variant.stock}`);

  // Create 3 test orders targeting this variant with quantity 3 each
  const orders = [];
  for (let i = 0; i < 3; i++) {
    const order = await prisma.order.create({
      data: {
        company: { connect: { id: companyId } },
        conversation: { connect: { id: conversation.id } },
        amount: 1500,
        status: "PENDING" as any,
        summary: `Multi-winner test order ${i + 1}`,
        source: "MANUAL" as any,
        orderItems: {
          create: [
            {
              company: { connect: { id: companyId } },
              name: product.name,
              quantity: 3,
              price: 500,
              sku: variant.id
            }
          ]
        }
      }
    });
    orders.push(order);
  }

  // 2. Fire 3 concurrent requests using Promise.all
  console.log("Firing 3 concurrent decrementStockForOrder requests (qty 3 each)...");
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
  console.log(`Requests fulfilled: ${fulfilledCount}`);
  console.log(`Requests rejected: ${rejectedCount}`);
  console.log(`Final stock value in DB: ${finalVariant?.stock}`);
  console.log(`StockHistory rows created: ${stockHistoryRows.length}`);
  console.log("StockHistory rows detail:");
  console.log(JSON.stringify(stockHistoryRows, null, 2));

  const failures: string[] = [];
  if (fulfilledCount !== 3) failures.push(`Expected 3 fulfilled requests, got ${fulfilledCount}`);
  if (finalVariant?.stock !== 1) failures.push(`Expected final stock 1, got ${finalVariant?.stock}`);
  if (stockHistoryRows.length !== 3) {
    failures.push(`Expected exactly 3 StockHistory rows, got ${stockHistoryRows.length}`);
  } else {
    // Chain assertions
    if (stockHistoryRows[0].oldStock !== 10) {
      failures.push(`Expected first row oldStock=10, got ${stockHistoryRows[0].oldStock}`);
    }
    for (let i = 0; i < stockHistoryRows.length - 1; i++) {
      if (stockHistoryRows[i].newStock !== stockHistoryRows[i + 1].oldStock) {
        failures.push(`Stock chain broken between row ${i} (newStock=${stockHistoryRows[i].newStock}) and row ${i + 1} (oldStock=${stockHistoryRows[i + 1].oldStock})`);
      }
    }
    if (stockHistoryRows[2].newStock !== 1) {
      failures.push(`Expected last row newStock=1, got ${stockHistoryRows[2].newStock}`);
    }

    // Duplicate pair check
    const pairs = stockHistoryRows.map(r => `${r.oldStock}->${r.newStock}`);
    const uniquePairs = new Set(pairs);
    if (uniquePairs.size !== pairs.length) {
      failures.push(`Found duplicate (oldStock, newStock) pairs in StockHistory: [${pairs.join(", ")}]`);
    }
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
  console.error("Multi-winner test script error:", err);
  prisma.$disconnect();
  process.exit(1);
});
