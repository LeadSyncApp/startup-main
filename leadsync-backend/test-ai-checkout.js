require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAICheckout() {
  // Use the REAL company (Om Sai Silk Boutique) that has inventory products
  const company = await prisma.company.findFirst({ where: { id: '3102a85e-1798-45bb-b6c5-d94ea436f775' }});
  console.log(`Using company: ${company.name} (${company.id})`);
  
  // List available products for context
  const products = await prisma.inventoryProduct.findMany({ where: { companyId: company.id, isActive: true }, select: { name: true, basePrice: true } });
  console.log('Available products:', products.map(p => `${p.name} @ ₹${p.basePrice}`).join(', '));
  
  console.log('\nInjecting webhook into pg-boss...');
  const PgBoss = require('pg-boss');
  const boss = new PgBoss(process.env.DATABASE_URL);
  boss.on('error', console.error);
  await boss.start();
  
  const externalChatId = 'test_price_fix_' + Date.now();
  
  // Use "Blue Silk Saree" which exists in inventory at ₹2500
  console.log('Sending order confirmation message (Blue Silk Saree x2)...');
  await boss.send('webhook.process', {
    companyId: company.id,
    channel: 'INSTAGRAM',
    externalChatId,
    contactName: 'Price Fix Test Buyer',
    text: 'I want to buy 2 Blue Silk Saree. My shipping address is: 42 Temple Street, Near Hanuman Mandir, Mumbai 400001. Please confirm my order.'
  });
  
  console.log('Wait 30s for AI to process...');
  await new Promise(r => setTimeout(r, 30000));
  
  const lead = await prisma.lead.findFirst({ 
    where: { contact: externalChatId }, 
    include: { 
      conversations: { 
        include: { 
          messages: { orderBy: { createdAt: 'asc' } }, 
          orders: { include: { orderItems: true } } 
        } 
      } 
    } 
  });
  
  if (!lead || !lead.conversations[0]) {
    console.log('ERROR: No lead or conversation created!');
    process.exit(1);
  }
  
  console.log('\n========== MESSAGES ==========');
  for (const msg of lead.conversations[0].messages) {
    console.log(`[${msg.sender}] ${msg.content}`);
  }
  
  console.log('\n========== ORDERS ==========');
  if (lead.conversations[0].orders.length === 0) {
    console.log('ERROR: No orders created.');
  }
  for (const order of lead.conversations[0].orders) {
    console.log(`Order ID: ${order.id}`);
    console.log(`  Status:  ${order.status}`);
    console.log(`  Amount:  ₹${order.amount}`);
    console.log(`  Summary: ${order.summary}`);
    console.log(`  Source:  ${order.source}`);
    if (order.orderItems && order.orderItems.length > 0) {
      console.log(`  Items:`);
      for (const item of order.orderItems) {
        console.log(`    - ${item.name} x${item.quantity} @ ₹${item.price} (productId: ${item.productId || 'none'})`);
      }
    }
    console.log(`  AMOUNT CHECK: ${order.amount > 0 ? '✅ PASS (non-zero)' : '❌ FAIL (zero!)'}`);
  }
  
  process.exit(0);
}

testAICheckout().catch(console.error);
