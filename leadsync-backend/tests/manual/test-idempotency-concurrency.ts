import { prisma } from "../../src/lib/prisma";
import { decrementStockForOrder } from "../../src/services/knowledge/inventory.service";

async function runConcurrencyTest() {
  console.log("🚀 Starting Idempotency & Concurrency Verification Test...\n");

  // 1. Fetch an existing active company or create test tenant context
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    console.error("No company found in database for test");
    process.exit(1);
  }
  const companyId = company.id;

  const timestamp = Date.now();
  const productSku = `SKU-${timestamp}`;
  const productName = `Idempotency Test Shirt ${timestamp}`;

  // 2. Create a test InventoryProduct & InventoryVariant with stock = 10
  const product = await prisma.inventoryProduct.create({
    data: {
      companyId,
      name: productName,
      sku: productSku,
      basePrice: 100,
      hasVariants: true,
      variants: {
        create: [
          {
            attributeValue: "Red",
            price: 100,
            stock: 10
          }
        ]
      }
    },
    include: { variants: true }
  });

  const variant = product.variants[0];

  // 3. Create a test Conversation & Order with 1 OrderItem (quantity 2)
  const lead = await prisma.lead.create({
    data: {
      companyId,
      name: "Idempotency Tester",
      contact: `999${Math.floor(1000000 + Math.random() * 9000000)}`,
      channel: "WEBSITE"
    }
  });

  const conversation = await prisma.conversation.create({
    data: {
      companyId,
      leadId: lead.id,
      channel: "WEBSITE",
      status: "OPEN"
    }
  });

  const order = await prisma.order.create({
    data: {
      companyId,
      conversationId: conversation.id,
      leadId: lead.id,
      amount: 200,
      summary: "Idempotency Test Order",
      status: "PENDING",
      stockDecremented: false,
      orderItems: {
        create: [
          {
            companyId,
            productId: null,
            sku: productSku,
            name: `${productName} - Red`,
            quantity: 2,
            price: 100
          }
        ]
      }
    }
  });

  // Query Initial DB State
  const initialOrder = await prisma.order.findUnique({
    where: { id: order.id },
    select: { id: true, stockDecremented: true }
  });
  const initialVariant = await prisma.inventoryVariant.findUnique({
    where: { id: variant.id },
    select: { id: true, stock: true }
  });
  const initialHistory = await prisma.stockHistory.findMany({
    where: { actorName: `Order ${order.id}` }
  });

  console.log("=== BEFORE CONCURRENT EXECUTION ===");
  console.log(`Order ID:                 ${initialOrder?.id}`);
  console.log(`Order stockDecremented:   ${initialOrder?.stockDecremented}`);
  console.log(`Variant Stock:            ${initialVariant?.stock}`);
  console.log(`StockHistory Rows Count:  ${initialHistory.length}`);
  console.log("===================================\n");

  // 4. Fire 2 CONCURRENT calls to decrementStockForOrder for the SAME order ID
  console.log("⚡ Firing 2 concurrent calls to decrementStockForOrder(order.id, companyId)...");
  await Promise.all([
    decrementStockForOrder(order.id, companyId),
    decrementStockForOrder(order.id, companyId)
  ]);
  console.log("⚡ Concurrent calls finished.\n");

  // 5. Query Final DB State
  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id },
    select: { id: true, stockDecremented: true }
  });
  const finalVariant = await prisma.inventoryVariant.findUnique({
    where: { id: variant.id },
    select: { id: true, stock: true }
  });
  const finalHistory = await prisma.stockHistory.findMany({
    where: { actorName: `Order ${order.id}` }
  });

  console.log("=== AFTER CONCURRENT EXECUTION ===");
  console.log(`Order ID:                 ${finalOrder?.id}`);
  console.log(`Order stockDecremented:   ${finalOrder?.stockDecremented}`);
  console.log(`Variant Initial Stock:    ${initialVariant?.stock}`);
  console.log(`Variant Final Stock:      ${finalVariant?.stock}`);
  console.log(`Actual Stock Decrement:   ${(initialVariant?.stock ?? 0) - (finalVariant?.stock ?? 0)}`);
  console.log(`StockHistory Rows Count:  ${finalHistory.length}`);
  console.log(`StockHistory Details:     `, JSON.stringify(finalHistory, null, 2));
  console.log("===================================\n");

  // Cleanup test entities
  await prisma.stockHistory.deleteMany({ where: { actorName: `Order ${order.id}` } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.conversation.delete({ where: { id: conversation.id } });
  await prisma.lead.delete({ where: { id: lead.id } });
  await prisma.inventoryVariant.delete({ where: { id: variant.id } });
  await prisma.inventoryProduct.delete({ where: { id: product.id } });

  console.log("🧹 Test cleanup completed.");
  process.exit(0);
}

runConcurrencyTest().catch((err) => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
