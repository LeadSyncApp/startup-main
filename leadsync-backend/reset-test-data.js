require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetTestData() {
  const companyId = '3102a85e-1798-45bb-b6c5-d94ea436f775';
  console.log(`=======================================================`);
  console.log(`🧹 SaLira Complete Test Data Reset Utility`);
  console.log(`Target Store: Om Sai Silk Boutique (${companyId})`);
  console.log(`=======================================================\n`);

  try {
    // 1. Delete all order items & orders for this company
    const allOrders = await prisma.order.findMany({ where: { companyId } });
    console.log(`Cleaning ${allOrders.length} test order(s)...`);
    await prisma.orderItem.deleteMany({ where: { companyId } });
    await prisma.invoice.deleteMany({ where: { companyId } });
    await prisma.orderLog.deleteMany({ where: { companyId } });
    await prisma.order.deleteMany({ where: { companyId } });

    // 2. Delete all draft orders, messages, conversations, and leads
    console.log(`Cleaning test leads, conversations, and messages...`);
    await prisma.draftOrder.deleteMany({ where: { companyId } });
    await prisma.message.deleteMany({ where: { companyId } });
    await prisma.conversationActivity.deleteMany({ where: { companyId } });
    await prisma.conversation.deleteMany({ where: { companyId } });
    await prisma.lead.deleteMany({ where: { companyId } });

    console.log(`\n✨ Database Reset Completely Clean!`);
    console.log(`- Cleared 100% of test leads, conversations, messages & orders.`);
    console.log(`- Master Inventory (Products & Variants) and Merchant Staff accounts are safe & intact.\n`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Reset Error:`, err);
    process.exit(1);
  }
}

resetTestData();
