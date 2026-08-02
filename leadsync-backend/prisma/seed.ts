/// <reference types="node" />
import { PrismaClient, Channel, LeadSegment, ConversationIntent, ConversationStatus, DraftOrderStatus, OrderStatus, OrderApprovalStatus, SourceChannel, OrderPriority, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SaLira pitch demo flow data (Real-time identical flow: Ajay & Deepak)...");

  const demoCompanyId = "company-demo-001";
  const demoCompanyCode = "DEMO001";

  // Clean existing demo company (cascades to all associated leads, conversations, orders, products)
  console.log("🧹 Cleaning old demo company data...");
  try {
    await prisma.company.deleteMany({ where: { companyCode: demoCompanyCode } });
  } catch (err: any) {
    console.log("Note during cleanup:", err?.message || err);
  }

  // 1. Create Demo Company
  const company = await prisma.company.create({
    data: {
      id: demoCompanyId,
      name: "Om Sai Silk Boutique (Demo)",
      companyCode: demoCompanyCode,
      businessName: "Om Sai Silk Boutique",
      businessAddress: "123, Fashion Street, Mumbai, Maharashtra 400001",
      currencySymbol: "₹",
      currencyCode: "INR",
      timezone: "Asia/Kolkata",
      businessStartHour: 8,
      businessEndHour: 22,
      telegramConnected: true,
      telegramBotToken: "mock_telegram_token",
      telegramBotUsername: "SaLiraDemoBot",
    },
  });
  console.log(`✅ Created Demo Company: ${company.name} (${company.id})`);

  // 2. Create Demo Users (Owner & Staff)
  const ownerPassword = await bcrypt.hash("demo1234", 10);
  const owner = await prisma.user.create({
    data: {
      id: "user-demo-owner",
      email: "demo@leadsync.test",
      firstName: "Demo",
      lastName: "Owner",
      passwordHash: ownerPassword,
      role: Role.OWNER,
      companyId: company.id,
      isActive: true,
      isAvailable: true,
      onboardingStatus: "ONBOARDED",
      authProvider: "EMAIL",
    },
  });

  const staffPassword = await bcrypt.hash("staff1234", 10);
  const staff = await prisma.user.create({
    data: {
      id: "user-demo-staff",
      email: "demo.staff@leadsync.test",
      firstName: "Demo",
      lastName: "Staff",
      passwordHash: staffPassword,
      role: Role.STAFF,
      companyId: company.id,
      isActive: true,
      isAvailable: true,
      onboardingStatus: "ONBOARDED",
      authProvider: "EMAIL",
    },
  });
  console.log(`✅ Created Owner (${owner.email}) & Staff (${staff.email})`);

  // 3. Create Demo Inventory (Banarasi Silk Saree & Chanderi Silk Stole)
  const sareeProduct = await prisma.inventoryProduct.create({
    data: {
      id: "prod-saree-001",
      companyId: company.id,
      name: "Banarasi Silk Saree",
      description: "Handloomed pure Banarasi silk saree with authentic gold zari weave.",
      sku: "SAREE-BANARASI-01",
      basePrice: 5800.0,
      basePriceInSubunits: BigInt(580000),
      categories: ["Sarees", "Silk", "Bridal"],
      hasVariants: true,
      variantAttributeName: "Color",
      variantAttributeNames: ["Color"],
      isAvailable: true,
      isActive: true,
      variants: {
        create: [
          {
            id: "var-saree-gold",
            attributeValue: "Royal Gold",
            attributes: { Color: "Royal Gold" },
            sku: "SAREE-BANARASI-GOLD",
            price: 5800.0,
            priceInSubunits: BigInt(580000),
            stock: 50,
            isActive: true,
          },
          {
            id: "var-saree-red",
            attributeValue: "Crimson Red",
            attributes: { Color: "Crimson Red" },
            sku: "SAREE-BANARASI-RED",
            price: 6200.0,
            priceInSubunits: BigInt(620000),
            stock: 35,
            isActive: true,
          },
        ],
      },
    },
  });

  const stoleProduct = await prisma.inventoryProduct.create({
    data: {
      id: "prod-stole-001",
      companyId: company.id,
      name: "Chanderi Silk Stole",
      description: "Lightweight handwoven Chanderi silk dupatta with subtle gold borders.",
      sku: "STOLE-CHANDERI-01",
      basePrice: 1800.0,
      basePriceInSubunits: BigInt(180000),
      categories: ["Dupattas", "Silk"],
      hasVariants: false,
      isAvailable: true,
      isActive: true,
    },
  });
  console.log(`✅ Created Demo Products: ${sareeProduct.name} (₹5,800) & ${stoleProduct.name} (₹1,800)`);

  // 4. Create Demo Leads (Normal real-time incoming chat structure, channels: TELEGRAM & WEBSITE)
  // Lead 1: Ajay (Target Unclaimed Demo Lead on TELEGRAM - clean incoming chat)
  const leadAjay = await prisma.lead.create({
    data: {
      id: "lead-ajay-001",
      companyId: company.id,
      name: "Ajay",
      contact: "+919811223344",
      channel: Channel.TELEGRAM,
      segment: LeadSegment.VIP,
      totalSpend: 18500.0,
      estimatedValue: 35000.0,
      city: "New Delhi",
      state: "Delhi",
      tags: ["VIP", "High Intent"],
      aiPriority: "HIGH",
      pendingOrderAmount: null, // Normal real-time chat without artificial pending order card
      pendingOrderState: "NONE",
      pendingOrderClaimedById: null,
      pendingOrderClaimedAt: null,
      pendingOrderSummary: null,
      lastActiveAt: new Date(),
    },
  });

  // Lead 2: Deepak (Unclaimed Lead on WEBSITE)
  const leadDeepak = await prisma.lead.create({
    data: {
      id: "lead-deepak-001",
      companyId: company.id,
      name: "Deepak",
      contact: "+919876543210",
      channel: Channel.WEBSITE,
      segment: LeadSegment.REGULAR,
      totalSpend: 6200.0,
      estimatedValue: 12000.0,
      city: "Mumbai",
      state: "Maharashtra",
      tags: ["Festive Wear"],
      aiPriority: "HIGH",
      pendingOrderAmount: null,
      pendingOrderState: "NONE",
      lastActiveAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  // Lead 3: Ananya (Browsing Lead on WEBSITE)
  const leadAnanya = await prisma.lead.create({
    data: {
      id: "lead-ananya-001",
      companyId: company.id,
      name: "Ananya",
      contact: "+917654321098",
      channel: Channel.WEBSITE,
      segment: LeadSegment.NEW,
      totalSpend: 0,
      estimatedValue: 2000.0,
      city: "Bengaluru",
      state: "Karnataka",
      tags: ["Browsing"],
      aiPriority: "LOW",
      pendingOrderAmount: null,
      pendingOrderState: "NONE",
      lastActiveAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  // Lead 4: Vikram (Baseline Order Lead on TELEGRAM)
  const leadVikram = await prisma.lead.create({
    data: {
      id: "lead-vikram-001",
      companyId: company.id,
      name: "Vikram",
      contact: "+919988776655",
      channel: Channel.TELEGRAM,
      segment: LeadSegment.VIP,
      totalSpend: 17400.0,
      estimatedValue: 25000.0,
      city: "Ahmedabad",
      state: "Gujarat",
      tags: ["VIP", "Corporate Buyer"],
      aiPriority: "HIGH",
      lastActiveAt: new Date(Date.now() - 120 * 60 * 1000),
    },
  });

  console.log(`✅ Created 4 Demo Leads (Ajay, Deepak, Ananya, Vikram)`);

  // 5. Create Unclaimed Conversations & Messages (Channels: TELEGRAM & WEBSITE only, fast path assignment)
  // Conv 1: Ajay (Target Unclaimed Chat — TELEGRAM — Priority Score 94/100, Intent: ORDERING)
  const convAjay = await prisma.conversation.create({
    data: {
      id: "ls-ajay-001",
      companyId: company.id,
      leadId: leadAjay.id,
      channel: Channel.TELEGRAM,
      mode: "BOT",
      status: ConversationStatus.OPEN,
      claimedById: null,
      assignedToId: null,
      priorityScore: 94,
      intent: ConversationIntent.ORDERING,
      aiSummary: "Customer requested 2x Banarasi Silk Sarees for an upcoming wedding. Urgent purchase intent.",
      suggestedAgentReply: "Hello Ajay! We have 2 Banarasi Silk Sarees in Royal Gold reserved for you at ₹11,600. Here is your payment link to confirm delivery!",
      transientIntentState: "ORDERING",
      needsStaffReason: "🎯 High purchase intent | ⚡ Just arrived",
      updatedAt: new Date(),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        id: "msg-ajay-001",
        companyId: company.id,
        conversationId: convAjay.id,
        sender: "CLIENT",
        content: "Hi! I want to buy 2 Banarasi Silk Sarees right away for an upcoming wedding. Total should be around ₹11,600. Can you confirm stock and send me the payment link?",
        messageType: "TEXT",
        platform: Channel.TELEGRAM,
        createdAt: new Date(Date.now() - 30 * 1000),
      },
      {
        id: "msg-ajay-002",
        companyId: company.id,
        conversationId: convAjay.id,
        sender: "SYSTEM",
        content: "Hello Ajay! 👋 Yes, we have 2 Banarasi Silk Sarees in Royal Gold in stock @ ₹5,800 each. Your total comes to ₹11,600.",
        messageType: "TEXT",
        platform: Channel.TELEGRAM,
        createdAt: new Date(Date.now() - 10 * 1000),
      },
    ],
  });

  // Conv 2: Deepak (Unclaimed Chat — WEBSITE — Priority Score 72/100)
  const convDeepak = await prisma.conversation.create({
    data: {
      id: "ls-deepak-001",
      companyId: company.id,
      leadId: leadDeepak.id,
      channel: Channel.WEBSITE,
      mode: "BOT",
      status: ConversationStatus.OPEN,
      claimedById: null,
      assignedToId: null,
      priorityScore: 72,
      intent: ConversationIntent.ORDERING,
      aiSummary: "Customer inquiring about 1x Banarasi Silk Saree in Crimson Red.",
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  await prisma.message.create({
    data: {
      id: "msg-deepak-001",
      companyId: company.id,
      conversationId: convDeepak.id,
      sender: "CLIENT",
      content: "Hi! Do you have the Crimson Red Banarasi Silk Saree in stock? I'd like to place an order.",
      messageType: "TEXT",
      platform: Channel.WEBSITE,
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  // Conv 3: Ananya (Browsing Chat — WEBSITE — Priority Score 35/100)
  const convAnanya = await prisma.conversation.create({
    data: {
      id: "ls-ananya-001",
      companyId: company.id,
      leadId: leadAnanya.id,
      channel: Channel.WEBSITE,
      mode: "BOT",
      status: ConversationStatus.OPEN,
      claimedById: null,
      assignedToId: null,
      priorityScore: 35,
      intent: ConversationIntent.BROWSING,
      aiSummary: "Visitor browsing Chanderi silk stoles catalog under ₹2,000.",
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  await prisma.message.create({
    data: {
      id: "msg-ananya-001",
      companyId: company.id,
      conversationId: convAnanya.id,
      sender: "CLIENT",
      content: "Looking for Chanderi silk stoles under ₹2,000 with floral embroidery.",
      messageType: "TEXT",
      platform: Channel.WEBSITE,
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  console.log(`✅ Created 3 Unclaimed Conversations on TELEGRAM & WEBSITE (Ajay: 94, Deepak: 72, Ananya: 35)`);

  // 6. Create Draft Order AND Pending Order for Ajay (₹11,600)
  // When payment is simulated in chat, this order converts to PAID, updating Orders page & Shop Dashboard!
  const draftOrderAjay = await prisma.draftOrder.create({
    data: {
      id: "draft-order-ajay-001",
      companyId: company.id,
      conversationId: convAjay.id,
      leadId: leadAjay.id,
      status: DraftOrderStatus.AWAITING_CONFIRMATION,
      totalAmount: 11600.0,
      totalAmountInSubunits: BigInt(1160000),
      recipientName: "Ajay",
      recipientPhone: "+919811223344",
      items: [
        {
          productId: sareeProduct.id,
          name: "Banarasi Silk Saree",
          quantity: 2,
          unitPrice: 5800.0,
          totalPrice: 11600.0,
          variant: "Royal Gold",
        },
      ],
      shippingAddress: {
        line1: "12 Park Avenue, Greater Kailash",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110048",
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const orderAjay = await prisma.order.create({
    data: {
      id: "ord-ajay-1089",
      companyId: company.id,
      conversationId: convAjay.id,
      leadId: leadAjay.id,
      summary: "2x Banarasi Silk Saree (Royal Gold)",
      amount: 11600.0,
      amountInSubunits: BigInt(1160000),
      status: OrderStatus.BOT_CREATED_ORDER,
      approvalStatus: OrderApprovalStatus.PENDING,
      sourceChannel: SourceChannel.TELEGRAM,
      priority: OrderPriority.URGENT,
      priorityScore: 94,
      stockDecremented: false,
      orderItems: {
        create: [
          {
            companyId: company.id,
            name: "Banarasi Silk Saree",
            quantity: 2,
            price: 5800.0,
            priceInSubunits: BigInt(580000),
            sku: "SAREE-BANARASI-GOLD",
          },
        ],
      },
    },
  });
  console.log(`✅ Created DraftOrder & Pending Order #ord-ajay-1089 for Ajay: ₹11,600`);

  // 7. Baseline Paid Order for Order Fulfillment Board (TELEGRAM)
  const orderVikram = await prisma.order.create({
    data: {
      id: "ord-vikram-1088",
      companyId: company.id,
      conversationId: convAjay.id,
      leadId: leadVikram.id,
      summary: "3x Banarasi Silk Saree (Royal Gold)",
      amount: 17400.0,
      amountInSubunits: BigInt(1740000),
      status: OrderStatus.PAID,
      approvalStatus: OrderApprovalStatus.APPROVED,
      sourceChannel: SourceChannel.TELEGRAM,
      priority: OrderPriority.URGENT,
      priorityScore: 88,
      stockDecremented: true,
      orderItems: {
        create: [
          {
            companyId: company.id,
            name: "Banarasi Silk Saree",
            quantity: 3,
            price: 5800.0,
            priceInSubunits: BigInt(580000),
            sku: "SAREE-BANARASI-GOLD",
          },
        ],
      },
    },
  });

  // 8. Create Shop Analytics Rollup
  await prisma.companyAnalyticsRollup.create({
    data: {
      companyId: company.id,
      totalRevenue: 17400.0,
      totalOrdersCount: 1,
      totalLeadsCount: 4,
    },
  });

  console.log(`✅ Created Baseline Fulfillment Order #ORD-1088 (READY/PAID ₹17,400) & Analytics Rollup`);

  console.log("\n🎉 SaLira Pitch Demo Flow Seed Complete!");
  console.log("\n========================================================");
  console.log("📋 DEMO LOGIN CREDENTIALS:");
  console.log("   Role: OWNER (Full Access to All Dashboard Tabs)");
  console.log("   Email:    demo@leadsync.test");
  console.log("   Password: demo1234");
  console.log("--------------------------------------------------------");
  console.log("   Role: STAFF");
  console.log("   Email:    demo.staff@leadsync.test");
  console.log("   Password: staff1234");
  console.log("========================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });