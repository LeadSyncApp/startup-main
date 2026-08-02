require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

async function testPaymentRequest() {
  const company = await prisma.company.findFirst({ where: { id: '3102a85e-1798-45bb-b6c5-d94ea436f775' } });
  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  
  // Fake login
  const token = jwt.sign(
    { userId: user.id, companyId: company.id, role: 'OWNER' }, 
    process.env.JWT_SECRET
  );
  
  const conversation = await prisma.conversation.findFirst({ where: { companyId: company.id } });
  const product = await prisma.inventoryProduct.findFirst({
    where: { companyId: company.id, isActive: true },
    include: { variants: true }
  });
  
  console.log(`Using product: ${product.name} (Base Price: ₹${product.basePrice})`);
  const selectedVariant = product.variants[0];
  if (selectedVariant) {
    console.log(`Using variant: ${selectedVariant.attributeValue} (Price: ₹${selectedVariant.price})`);
  }

  // Test 1: Empty search to verify default products load
  const searchRes = await fetch('http://localhost:4000/api/companies/search?q=', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const searchData = await searchRes.json();
  console.log('\nDefault Search Products count:', searchData.products?.length);
  if (searchData.products?.length > 0) {
    console.log('First default product:', searchData.products[0].name);
  }

  // Test 2: Generate Catalog Payment Link with quantity 3
  const res = await fetch('http://localhost:4000/api/orders/payment-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      conversationId: conversation.id,
      products: [
        {
          productId: product.id,
          variantId: selectedVariant?.id,
          quantity: 3
        }
      ],
      note: `Payment for 3x ${product.name}`
    })
  });
  
  const data = await res.json();
  console.log('\nPayment Link Generation Response:', data);
  
  if (data.order) {
    const order = await prisma.order.findFirst({
      where: { id: data.order.id },
      include: { orderItems: true }
    });
    console.log('\nCreated Order Details:');
    console.log(`  ID: ${order.id}`);
    console.log(`  Amount: ₹${order.amount}`);
    console.log(`  Summary: ${order.summary}`);
    console.log(`  Items:`);
    for (const item of order.orderItems) {
      console.log(`    - ${item.name} x${item.quantity} @ ₹${item.price} (productId: ${item.productId})`);
    }
  }
}

testPaymentRequest().catch(console.error);
