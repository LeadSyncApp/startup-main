/// <reference types="node" />
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding demo data...");

  // Clean existing demo data
  await prisma.claimLog.deleteMany({ where: { conversationId: { in: ["ls-101", "ls-102", "ls-103", "ls-104"] } } });
  await prisma.message.deleteMany({ where: { conversationId: { in: ["ls-101", "ls-102", "ls-103", "ls-104"] } } });
  await prisma.conversation.deleteMany({ where: { id: { in: ["ls-101", "ls-102", "ls-103", "ls-104"] } } });
  await prisma.lead.deleteMany({ where: { id: { in: ["lead-101", "lead-102", "lead-103", "lead-104"] } } });
  await prisma.user.deleteMany({ where: { email: { in: ["demo@leadsync.test", "demo.staff@leadsync.test"] } } });
  await prisma.company.deleteMany({ where: { companyCode: "DEMO001" } });

  // 1. Create demo company
  const company = await prisma.company.create({
    data: {
      id: "company-demo-001",
      name: "Om Sai Silk Boutique (Demo)",
      companyCode: "DEMO001",
      businessName: "Om Sai Silk Boutique",
      businessAddress: "123, Fashion Street, Mumbai, Maharashtra 400001",
      currencySymbol: "₹",
      currencyCode: "INR",
      timezone: "Asia/Kolkata",
      businessStartHour: 8,
      businessEndHour: 22,
    },
  });
  console.log(`✅ Created company: ${company.name} (${company.id})`);

  // 2. Create demo owner user
  const ownerPassword = await bcrypt.hash("demo1234", 10);
  const owner = await prisma.user.create({
    data: {
      id: "user-demo-owner",
      email: "demo@leadsync.test",
      firstName: "Demo",
      lastName: "Owner",
      passwordHash: ownerPassword,
      role: "OWNER",
      companyId: company.id,
      isActive: true,
      isOnline: false,
      onboardingStatus: "ONBOARDED",
      authProvider: "EMAIL",
    },
  });
  console.log(`✅ Created owner: ${owner.email} (password: demo1234)`);

  // 3. Create demo staff user
  const staffPassword = await bcrypt.hash("staff1234", 10);
  const staff = await prisma.user.create({
    data: {
      id: "user-demo-staff",
      email: "demo.staff@leadsync.test",
      firstName: "Demo",
      lastName: "Staff",
      passwordHash: staffPassword,
      role: "STAFF",
      companyId: company.id,
      isActive: true,
      isOnline: false,
      onboardingStatus: "ONBOARDED",
      authProvider: "EMAIL",
    },
  });
  console.log(`✅ Created staff: ${staff.email} (password: staff1234)`);

  // 4. Create demo leads
  const leadsData = [
    { id: "lead-101", name: "Aarav Mehta", contact: "+919876543210", channel: "WHATSAPP" as const, segment: "VIP" as const, totalSpend: 15000, estimatedValue: 25000, city: "Mumbai", state: "Maharashtra" },
    { id: "lead-102", name: "Kavya Deshmukh", contact: "+918765432109", channel: "INSTAGRAM" as const, segment: "NEW" as const, totalSpend: 0, estimatedValue: 3000, city: "Pune", state: "Maharashtra" },
    { id: "lead-103", name: "Vikram Malhotra", contact: "+917654321098", channel: "TELEGRAM" as const, segment: "REGULAR" as const, totalSpend: 8500, estimatedValue: 5000, city: "Delhi", state: "Delhi" },
    { id: "lead-104", name: "Riya Sen", contact: "+919988776655", channel: "WHATSAPP" as const, segment: "REGULAR" as const, totalSpend: 6200, estimatedValue: 4000, city: "Bengaluru", state: "Karnataka" },
  ];

  for (const leadData of leadsData) {
    await prisma.lead.create({
      data: {
        id: leadData.id,
        name: leadData.name,
        contact: leadData.contact,
        channel: leadData.channel,
        segment: leadData.segment,
        totalSpend: leadData.totalSpend,
        estimatedValue: leadData.estimatedValue,
        city: leadData.city,
        state: leadData.state,
        companyId: company.id,
        aiPriority: leadData.segment === "VIP" ? "HIGH" as const : leadData.segment === "REGULAR" ? "MEDIUM" as const : "LOW" as const,
      },
    });
  }
  console.log(`✅ Created ${leadsData.length} demo leads`);

  // 5. Create demo conversations matching mock data IDs
  type ConvData = {
    id: string;
    channel: "WHATSAPP" | "TELEGRAM" | "INSTAGRAM";
    leadId: string;
    mode: "BOT" | "HUMAN";
    priorityScore: number;
    intent: "BROWSING" | "ORDERING" | "SUPPORT";
    status: "OPEN" | "ASSIGNED";
    assignedToId: string | null;
    claimedById: string | null;
    claimExpiresAt: Date | null;
  };
  const conversationsData: ConvData[] = [
    {
      id: "ls-101",
      channel: "WHATSAPP",
      leadId: "lead-101",
      mode: "BOT",
      priorityScore: 82,
      intent: "ORDERING",
      status: "OPEN",
      assignedToId: null,
      claimedById: null,
      claimExpiresAt: null,
    },
    {
      id: "ls-102",
      channel: "INSTAGRAM",
      leadId: "lead-102",
      mode: "BOT",
      priorityScore: 45,
      intent: "BROWSING",
      status: "OPEN",
      assignedToId: null,
      claimedById: null,
      claimExpiresAt: null,
    },
    {
      id: "ls-103",
      channel: "TELEGRAM",
      leadId: "lead-103",
      mode: "HUMAN",
      priorityScore: 28,
      intent: "SUPPORT",
      status: "ASSIGNED",
      assignedToId: null,
      claimedById: owner.id,
      claimExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min lease
    },
    {
      id: "ls-104",
      channel: "WHATSAPP",
      leadId: "lead-104",
      mode: "BOT",
      priorityScore: 22,
      intent: "BROWSING",
      status: "OPEN",
      assignedToId: null,
      claimedById: null,
      claimExpiresAt: null,
    },
  ];

  for (const convData of conversationsData) {
    await prisma.conversation.create({
      data: {
        ...convData,
        companyId: company.id,
      },
    });
  }
  console.log(`✅ Created ${conversationsData.length} demo conversations`);

  // 6. Create demo messages for each conversation
  type MsgData = {
    conversationId: string;
    content: string;
    sender: "CLIENT" | "AGENT" | "SYSTEM";
  };
  const messagesData: MsgData[] = [
    // ls-101 messages (Aarav Mehta - WhatsApp)
    { conversationId: "ls-101", content: "Namaste, I see your handcrafted collection on Instagram.", sender: "CLIENT" },
    { conversationId: "ls-101", content: "Namaste! Welcome to Om Sai Silk Boutique. Click any item sku to fetch price structure.", sender: "SYSTEM" },
    { conversationId: "ls-101", content: "Can you confirm if you have the Handcrafted Brass Tea Pot in stock?", sender: "CLIENT" },
    { conversationId: "ls-101", content: "Yes! Brass Tea Pot (#TEAPOT-44) is available for ₹2,100 (excluding 18% GST). Would you like me to book it?", sender: "SYSTEM" },
    { conversationId: "ls-101", content: "Understood, please finalize my order for the Handcrafted Brass Tea Pot.", sender: "CLIENT" },
    // ls-102 messages (Kavya Deshmukh - Instagram)
    { conversationId: "ls-102", content: "Hi! Loved the Premium Silk Kurti post.", sender: "CLIENT" },
    { conversationId: "ls-102", content: "Hello! Our Silk Kurtis are hand-loomed with premium silk zari. We offer custom sizes too.", sender: "SYSTEM" },
    { conversationId: "ls-102", content: "How much is express shipping to Mumbai Zone 2 region?", sender: "CLIENT" },
    // ls-103 messages (Vikram Malhotra - Telegram)
    { conversationId: "ls-103", content: "Do you have any footwear collections available?", sender: "CLIENT" },
    { conversationId: "ls-103", content: "Yes Vikram, we carry premium handcrafted leather sandals.", sender: "AGENT" },
    { conversationId: "ls-103", content: "Do you have the Kolhapuri chappals in Tan color size 10?", sender: "CLIENT" },
    // ls-104 messages (Riya Sen - WhatsApp)
    { conversationId: "ls-104", content: "Is my coupon still valid for purchase?", sender: "CLIENT" },
    { conversationId: "ls-104", content: "Indeed Riya! The code INS500 grants ₹500 discount on values above ₹2000.", sender: "SYSTEM" },
    { conversationId: "ls-104", content: "Thanks, checking the catalog link.", sender: "CLIENT" },
  ];

  for (const msgData of messagesData) {
    await prisma.message.create({
      data: {
        conversationId: msgData.conversationId,
        content: msgData.content,
        sender: msgData.sender,
        companyId: company.id,
        messageType: "TEXT",
      },
    });
  }
  console.log(`✅ Created ${messagesData.length} demo messages`);

  // 7. Create ClaimLog entries for the already-claimed conversation (ls-103)
  await prisma.claimLog.create({
    data: {
      companyId: company.id,
      conversationId: "ls-103",
      actorId: owner.id,
      actorName: "Demo Owner",
      action: "CLAIM",
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    },
  });
  // Add a heartbeat log to show lease renewal
  await prisma.claimLog.create({
    data: {
      companyId: company.id,
      conversationId: "ls-103",
      actorId: owner.id,
      actorName: "Demo Owner",
      action: "HEARTBEAT",
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    },
  });
  console.log(`✅ Created ClaimLog entries for conversation ls-103 (CLAIM + HEARTBEAT)`);

  // 8. Seed default automation rules for the demo company
  // These are basic rules that make sense out of the box for any new company
  await prisma.automationRule.createMany({
    data: [
      {
        companyId: company.id,
        name: "Greeting & Language Menu",
        trigger: "keyword:hi,hello,namaste,start",
        action: "send_message:Namaste! Welcome to our store. How can we help you today?",
        isActive: true,
      },
      {
        companyId: company.id,
        name: "Human Verification",
        trigger: "keyword:human,agent,support,call",
        action: "handover:Transferring you to our support agent. Please wait...",
        isActive: true,
      },
      {
        companyId: company.id,
        name: "Price Inquiry",
        trigger: "intent:PRICE_CHECK",
        action: "send_catalog:CATALOG_SUMMER_24",
        isActive: false,
      },
    ],
  });
  console.log(`✅ Created 3 default automation rules for demo company`);

  console.log("\n🎉 Seed complete!");
  console.log("\n📋 Demo login credentials:");
  console.log("   Owner: demo@leadsync.test / demo1234");
  console.log("   Staff: demo.staff@leadsync.test / staff1234");
  console.log("\n💬 Demo conversations:");
  console.log("   ls-101: Aarav Mehta (WhatsApp) - unclaimed");
  console.log("   ls-102: Kavya Deshmukh (Instagram) - unclaimed");
  console.log("   ls-103: Vikram Malhotra (Telegram) - claimed by owner (with ClaimLog)");
  console.log("   ls-104: Riya Sen (WhatsApp) - unclaimed");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });