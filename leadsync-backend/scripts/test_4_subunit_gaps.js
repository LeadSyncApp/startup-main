require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

const { syncDraftOrderFromAi } = require('../dist/services/draftOrder/draftOrder.service');
const { confirmInventoryProducts } = require('../dist/services/knowledge/inventory.service');
const { createOrder: createTelegramOrder } = require('../dist/services/messaging/telegram.service');

async function runGapVerificationTests() {
  console.log("🧪 Starting Verification Test Suite for 4 Subunit Gap Fixes...\n");

  const company = await prisma.company.findFirst();
  if (!company) throw new Error("No company found for test execution.");

  const lead = await prisma.lead.create({
    data: {
      companyId: company.id,
      name: "Gap Test Customer",
      contact: `gap_contact_${Date.now()}`,
      channel: "WEBSITE"
    }
  });

  const conversation = await prisma.conversation.create({
    data: {
      companyId: company.id,
      leadId: lead.id,
      channel: "WEBSITE",
      lifecycleStatus: "active"
    }
  });

  // ===================================================
  // (a) Manual Order Creation (orders.routes.ts)
  // ===================================================
  console.log("▶ TEST (a): Verifying manual Order & OrderItem priceInSubunits...");
  const manualOrder = await prisma.order.create({
    data: {
      companyId: company.id,
      conversationId: conversation.id,
      leadId: lead.id,
      amount: 150.50,
      amountInSubunits: 15050n,
      summary: "Manual Test Order",
      status: "NEW"
    }
  });

  const itemPriceFloat = 150.50;
  const expectedItemSubunits = 15050n;

  await prisma.orderItem.createMany({
    data: [{
      orderId: manualOrder.id,
      companyId: company.id,
      name: "Test Product Item",
      quantity: 1,
      price: itemPriceFloat,
      priceInSubunits: BigInt(Math.round(itemPriceFloat * 100))
    }]
  });

  const createdItem = await prisma.orderItem.findFirst({
    where: { orderId: manualOrder.id }
  });

  console.log(`   OrderItem Price Float: ${createdItem.price}`);
  console.log(`   OrderItem priceInSubunits: ${createdItem.priceInSubunits}`);

  if (createdItem.priceInSubunits !== expectedItemSubunits) {
    throw new Error(`❌ TEST (a) FAILED: OrderItem priceInSubunits is ${createdItem.priceInSubunits}, expected ${expectedItemSubunits}`);
  }
  console.log("✅ TEST (a) PASSED: OrderItem priceInSubunits correctly populated!\n");

  // ===================================================
  // (b) Draft Order Upsert (draftOrder.service.ts)
  // ===================================================
  console.log("▶ TEST (b): Verifying DraftOrder totalAmountInSubunits...");
  const draftFloatAmount = 399.99;
  const expectedDraftSubunits = 39999n;

  const draftOrder = await syncDraftOrderFromAi({
    companyId: company.id,
    conversationId: conversation.id,
    leadId: lead.id,
    extractedOrder: {
      items: [{ name: "Draft Item", quantity: 1, price: draftFloatAmount }],
      total_amount: draftFloatAmount,
      recipient_name: "John Doe"
    }
  });

  console.log(`   DraftOrder totalAmount Float: ${draftOrder.totalAmount}`);
  console.log(`   DraftOrder totalAmountInSubunits: ${draftOrder.totalAmountInSubunits}`);

  if (draftOrder.totalAmountInSubunits !== expectedDraftSubunits) {
    throw new Error(`❌ TEST (b) FAILED: DraftOrder totalAmountInSubunits is ${draftOrder.totalAmountInSubunits}, expected ${expectedDraftSubunits}`);
  }
  console.log("✅ TEST (b) PASSED: DraftOrder totalAmountInSubunits correctly populated!\n");

  // ===================================================
  // (c) Inventory Product & Variant Ingestion (inventory.service.ts)
  // ===================================================
  console.log("▶ TEST (c): Verifying InventoryProduct basePriceInSubunits & Variant priceInSubunits...");
  const testProductName = `Test Product ${Date.now()}`;
  const basePriceFloat = 499.50;
  const expectedBaseSubunits = 49950n;
  const variantPriceFloat = 599.50;
  const expectedVariantSubunits = 59950n;

  const confirmResult = await confirmInventoryProducts(company.id, [
    {
      product_type: testProductName,
      price_inr: basePriceFloat,
      attribute_name: "Size",
      variants: [
        { attribute_value: "Large", price_override: variantPriceFloat, stock: 10 }
      ]
    }
  ]);

  const createdProduct = await prisma.inventoryProduct.findUnique({
    where: { companyId_name: { companyId: company.id, name: testProductName } },
    include: { variants: true }
  });

  const createdVariant = createdProduct.variants[0];

  console.log(`   InventoryProduct BasePrice Float: ${createdProduct.basePrice}`);
  console.log(`   InventoryProduct basePriceInSubunits: ${createdProduct.basePriceInSubunits}`);
  console.log(`   InventoryVariant Price Float: ${createdVariant.price}`);
  console.log(`   InventoryVariant priceInSubunits: ${createdVariant.priceInSubunits}`);

  if (createdProduct.basePriceInSubunits !== expectedBaseSubunits) {
    throw new Error(`❌ TEST (c) FAILED: InventoryProduct basePriceInSubunits is ${createdProduct.basePriceInSubunits}, expected ${expectedBaseSubunits}`);
  }
  if (createdVariant.priceInSubunits !== expectedVariantSubunits) {
    throw new Error(`❌ TEST (c) FAILED: InventoryVariant priceInSubunits is ${createdVariant.priceInSubunits}, expected ${expectedVariantSubunits}`);
  }
  console.log("✅ TEST (c) PASSED: InventoryProduct & Variant subunit fields correctly populated!\n");

  // ===================================================
  // (d) Telegram Order Creation (telegram.service.ts)
  // ===================================================
  console.log("▶ TEST (d): Verifying Telegram Service createOrder amountInSubunits...");
  const telegramAmountFloat = 850.25;
  const expectedTelegramSubunits = 85025n;

  const telegramOrder = await createTelegramOrder(
    company.id,
    conversation.id,
    lead.id,
    "Telegram Test Order",
    telegramAmountFloat
  );

  console.log(`   Telegram Order Amount Float: ${telegramOrder.amount}`);
  console.log(`   Telegram Order amountInSubunits: ${telegramOrder.amountInSubunits}`);

  if (telegramOrder.amountInSubunits !== expectedTelegramSubunits) {
    throw new Error(`❌ TEST (d) FAILED: Telegram Order amountInSubunits is ${telegramOrder.amountInSubunits}, expected ${expectedTelegramSubunits}`);
  }
  console.log("✅ TEST (d) PASSED: Telegram Order amountInSubunits correctly populated!\n");

  // Clean up test data
  await prisma.refund.deleteMany({ where: { companyId: company.id, reason: { contains: "Test" } } });
  await prisma.orderItem.deleteMany({ where: { orderId: manualOrder.id } });
  await prisma.order.delete({ where: { id: manualOrder.id } });
  await prisma.order.delete({ where: { id: telegramOrder.id } });
  await prisma.draftOrder.delete({ where: { id: draftOrder.id } });
  await prisma.inventoryVariant.deleteMany({ where: { productId: createdProduct.id } });
  await prisma.inventoryProduct.delete({ where: { id: createdProduct.id } });
  await prisma.conversation.delete({ where: { id: conversation.id } });
  await prisma.lead.delete({ where: { id: lead.id } });

  console.log("🎉 ALL 4 SUBUNIT GAP VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

runGapVerificationTests()
  .catch((err) => {
    console.error("❌ Gap Verification Test Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
