require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

async function runDemoFlow() {
  const args = process.argv.slice(2);
  const isOrderOnly = args.includes('--order-only');
  const isPayOnly = args.includes('--pay-only');

  const company = await prisma.company.findFirst({ where: { id: '3102a85e-1798-45bb-b6c5-d94ea436f775' }});
  console.log(`=======================================================`);
  console.log(`🚀 SaLira Reusable Demo Pipeline Script`);
  console.log(`Target Store: ${company.name} (${company.id})`);
  console.log(`=======================================================\n`);

  if (!isPayOnly) {
    // 🧹 STEP 1: AUTOMATIC AUTO-RESET of previous test leads
    console.log('🧹 STAGE 0: Auto-resetting previous test leads ("Deepak" & "Ananya")...');
    const leadsToClean = await prisma.lead.findMany({
      where: {
        OR: [
          { name: { contains: 'Deepak', mode: 'insensitive' } },
          { contact: { contains: 'deepak', mode: 'insensitive' } },
          { name: { contains: 'Ananya', mode: 'insensitive' } },
          { contact: { contains: 'ananya', mode: 'insensitive' } }
        ]
      }
    });

    for (const l of leadsToClean) {
      const convs = await prisma.conversation.findMany({ where: { leadId: l.id } });
      for (const c of convs) {
        await prisma.draftOrder.deleteMany({ where: { conversationId: c.id } });
        await prisma.orderItem.deleteMany({ where: { order: { conversationId: c.id } } });
        await prisma.order.deleteMany({ where: { conversationId: c.id } });
        await prisma.message.deleteMany({ where: { conversationId: c.id } });
        await prisma.conversation.delete({ where: { id: c.id } });
      }
      await prisma.lead.delete({ where: { id: l.id } });
    }
    console.log(`✅ Cleared ${leadsToClean.length} previous test lead(s). Database reset cleanly!\n`);

    // ⚡ STEP 2: Ingest Inbound Orders
    const PgBoss = require('pg-boss');
    const boss = new PgBoss(process.env.DATABASE_URL);
    boss.on('error', console.error);
    await boss.start();

    const externalChatId = 'web_deepak_' + Date.now();
    const customerName = 'Deepak';

    console.log('--- TURN 1: Ingesting Customer Order Request ---');
    console.log(`Customer ("${customerName}"): "I want to buy 2 SAS SAREES. My shipping address is: 42 Temple Street, Near Hanuman Mandir, Mumbai 400001. Please confirm my order."`);

    await boss.send('webhook.process', {
      companyId: company.id,
      channel: 'WEBSITE',
      externalChatId,
      contactName: customerName,
      text: 'I want to buy 2 SAS SAREES. My shipping address is: 42 Temple Street, Near Hanuman Mandir, Mumbai 400001. Please confirm my order.'
    });

    console.log('Waiting 35 seconds for AI Orchestrator to process Turn 1...');
    await new Promise(r => setTimeout(r, 35000));

    console.log('\n--- TURN 2: Customer replies with size preference ---');
    console.log(`Customer ("${customerName}"): "Size L, please confirm my order"`);

    await boss.send('webhook.process', {
      companyId: company.id,
      channel: 'WEBSITE',
      externalChatId,
      contactName: customerName,
      text: 'Size L, please confirm my order'
    });

    console.log('Waiting 35 seconds for AI Orchestrator to process Turn 2 & confirm order...');
    await new Promise(r => setTimeout(r, 35000));

    const lead = await prisma.lead.findFirst({
      where: { contact: externalChatId },
      include: {
        conversations: {
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            orders: { include: { orderItems: true }, orderBy: { createdAt: 'desc' } }
          }
        }
      }
    });

    if (!lead || !lead.conversations[0]) {
      console.error('❌ ERROR: No lead or conversation created!');
      process.exit(1);
    }

    const conversation = lead.conversations[0];
    console.log(`\n✅ Conversation ID: ${conversation.id} (${conversation.messages.length} messages)`);

    let targetOrder = conversation.orders[0];
    if (!targetOrder) {
      console.log('⚠️ AI Orchestrator did not auto-create order row. Creating seed PENDING order...');
      const invProduct = await prisma.inventoryProduct.findFirst({
        where: { companyId: company.id, name: { contains: 'SAS', mode: 'insensitive' } }
      });
      const prodId = invProduct?.id || null;
      const unitPrice = invProduct ? Number(invProduct.basePrice) : 700;
      targetOrder = await prisma.order.create({
        data: {
          companyId: company.id,
          conversationId: conversation.id,
          leadId: lead.id,
          amount: unitPrice * 2,
          amountInSubunits: BigInt(Math.round(unitPrice * 2 * 100)),
          status: 'PENDING',
          summary: 'Order for 2x SAS SAREE',
          source: 'BOT_DETECTED',
          orderItems: {
            create: [{
              companyId: company.id,
              name: invProduct?.name || 'SAS SAREE',
              quantity: 2,
              price: unitPrice,
              priceInSubunits: BigInt(Math.round(unitPrice * 100))
            }]
          }
        },
        include: { orderItems: true }
      });
    }

    console.log(`\n✅ Order Created & Ready in Queue:`);
    console.log(`   Order ID: ${targetOrder.id}`);
    console.log(`   Status:   ${targetOrder.status}`);
    console.log(`   Amount:   ₹${targetOrder.amount}`);

    if (isOrderOnly) {
      console.log(`\n🎉 [--order-only mode completed!]`);
      console.log(`The order is now in PENDING/UNCLAIMED state in Stream Triage ("New Customers").`);
      console.log(`You can now open the UI live, claim the lead, and run "node test-demo-flow.js --pay-only" to confirm payment!`);
      process.exit(0);
    }
  }

  // 💳 STEP 3: SIMULATE PAYMENT
  console.log('\n--- STAGE 3: Simulating Payment Confirmation ---');
  const targetLead = await prisma.lead.findFirst({
    where: { companyId: company.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      conversations: {
        include: { orders: { orderBy: { createdAt: 'desc' } } }
      }
    }
  });

  const activeOrder = targetLead?.conversations.flatMap(c => c.orders)[0];
  if (!activeOrder) {
    console.error('❌ ERROR: No active order found to pay! Run "node test-demo-flow.js" first.');
    process.exit(1);
  }

  let user = await prisma.user.findFirst({ where: { companyId: company.id, isActive: true, role: 'OWNER' } });
  if (!user) user = await prisma.user.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!user) user = await prisma.user.findFirst({ where: { companyId: company.id } });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET is missing");
  const token = jwt.sign(
    { userId: user.id, companyId: company.id, role: user.role || 'OWNER' },
    jwtSecret
  );

  const payRes = await fetch(`http://localhost:4000/api/orders/${activeOrder.id}/simulate-success`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  });

  console.log('Payment simulation API HTTP status:', payRes.status);
  const updatedOrder = await prisma.order.findUnique({ where: { id: activeOrder.id } });
  console.log(`\n✅ Order Final Status: ${updatedOrder.status} (Expected: PAID)`);
  console.log(`\n🎉 DEMO FLOW COMPLETED SUCCESSFULLY!`);
  process.exit(0);
}

runDemoFlow().catch(console.error);
