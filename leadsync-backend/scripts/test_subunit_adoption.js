require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

const { newOrderArrivalService } = require('../dist/services/workflow/newOrderArrival.service');
const { billingService } = require('../dist/services/billing/billing.service');
const { invoiceService } = require('../dist/services/integrations/invoice.service');

async function verifySubunitAdoption() {
  console.log("🧪 Starting Subunit Adoption Verification Test Suite...\n");

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("No company found in database for test execution.");
  }

  // 1. Create a brand-new conversation and lead for testing
  const lead = await prisma.lead.create({
    data: {
      companyId: company.id,
      name: "Test Customer",
      contact: `contact_${Date.now()}`,
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

  const testAmount = 250.75; // ₹250.75 => expected 25075 paise
  const expectedSubunits = 25075n;

  console.log(`▶ 1. Processing new order via newOrderArrivalService with float amount ₹${testAmount}...`);
  const arrivalResult = await newOrderArrivalService.processNewOrderArrival({
    companyId: company.id,
    conversationId: conversation.id,
    leadId: lead.id,
    summary: "Test Subunit Adoption Order",
    amount: testAmount,
    items: [
      { name: "Test Item 1", quantity: 1, price: 250.75 }
    ]
  });

  const createdOrder = arrivalResult.order;

  console.log(`   Order Created ID: ${createdOrder.id}`);
  console.log(`   DB float amount: ${createdOrder.amount}`);
  console.log(`   DB amountInSubunits: ${createdOrder.amountInSubunits}`);

  if (createdOrder.amountInSubunits !== expectedSubunits) {
    throw new Error(`❌ Test Failed: Order amountInSubunits is ${createdOrder.amountInSubunits}, expected ${expectedSubunits}`);
  }
  console.log("✅ Step 1 PASSED: Order amountInSubunits correctly populated (non-zero & matching float_value * 100)!\n");

  const { resolveTenantContext, tenantContextStorage } = require('../dist/services/context/tenantContext.provider');

  // 2. Test Invoice Generation via Billing Microservice
  console.log("▶ 2. Generating Invoice via BillingMicroservice...");
  const tenantContext = await resolveTenantContext(company.id);
  await tenantContextStorage.run(tenantContext, async () => {
    await billingService.handleOrderCreated(createdOrder.id, company.id);
  });

  const invoice = await prisma.invoice.findFirst({
    where: { orderId: createdOrder.id }
  });

  if (!invoice) {
    throw new Error("❌ Test Failed: Invoice was not created for order");
  }

  console.log(`   Invoice Number: ${invoice.invoiceNumber}`);
  console.log(`   Invoice subtotalInSubunits: ${invoice.subtotalInSubunits}`);
  console.log(`   Invoice totalInSubunits: ${invoice.totalInSubunits}`);

  if (invoice.subtotalInSubunits !== expectedSubunits || invoice.totalInSubunits !== expectedSubunits) {
    throw new Error(`❌ Test Failed: Invoice subtotalInSubunits (${invoice.subtotalInSubunits}) or totalInSubunits (${invoice.totalInSubunits}) does not match ${expectedSubunits}`);
  }
  console.log("✅ Step 2 PASSED: Invoice subtotalInSubunits and totalInSubunits correctly populated!\n");

  // 3. Test Dashboard Aggregation Query
  console.log("▶ 3. Testing Dashboard Aggregate Query (_sum: { amountInSubunits: true })...");
  const revenueAggregate = await prisma.order.aggregate({
    where: { id: createdOrder.id },
    _sum: { amountInSubunits: true }
  });

  console.log(`   Aggregated amountInSubunits sum: ${revenueAggregate._sum.amountInSubunits}`);
  if (revenueAggregate._sum.amountInSubunits !== expectedSubunits) {
    throw new Error(`❌ Test Failed: Dashboard revenue aggregate returned ${revenueAggregate._sum.amountInSubunits}, expected ${expectedSubunits}`);
  }
  console.log("✅ Step 3 PASSED: Dashboard aggregate query correctly computes over amountInSubunits!\n");

  // Clean up test order & invoice
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await prisma.orderLog.deleteMany({ where: { orderId: createdOrder.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: createdOrder.id } });
  await prisma.order.delete({ where: { id: createdOrder.id } });
  await prisma.conversation.delete({ where: { id: conversation.id } });
  await prisma.lead.delete({ where: { id: lead.id } });

  console.log("🎉 ALL SUBUNIT ADOPTION VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

verifySubunitAdoption()
  .catch((err) => {
    console.error("❌ Verification Test Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
