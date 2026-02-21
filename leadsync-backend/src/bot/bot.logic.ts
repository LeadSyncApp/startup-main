import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateBotReply } from "../services/geminiService";

/* =====================================================
   SWITCH TO BOT MODE
===================================================== */
export async function switchToBot(conversationId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { mode: "BOT" },
  });
}

/* =====================================================
   SWITCH TO HUMAN MODE
===================================================== */
export async function switchToHuman(conversationId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { mode: "HUMAN" },
  });
}

/* =====================================================
   HANDLE BOT MESSAGE (MULTI-TENANT + STRUCTURED MENU)
===================================================== */
export async function handleBotMessage(
  conversationId: string,
  userMessage: string,
  modality: "text" | "voice" = "text",
  detectedLanguage: string = "en-IN"
): Promise<string | null> {
  // 1️⃣ Get conversation with Lead (Customer Profile)
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: true }
  });

  if (!conversation || conversation.mode !== "BOT") {
    return null;
  }

  // 2️⃣ Fetch company configuration
  const company = await prisma.company.findUnique({
    where: { id: conversation.companyId },
    select: {
      name: true,
      botBusinessType: true,
      botStructuredMenu: true,
    },
  });

  const businessName = company?.name || "our company";
  const businessType =
    company?.botBusinessType || "general business";

  const structuredMenu = company?.botStructuredMenu || null;

  // 3️⃣ Fetch History (Context)
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const historyContext = history
    .reverse()
    .filter(m => m.content !== userMessage) // Avoid double current message
    .map(m => ({
      role: m.sender === "CLIENT" ? "user" : "assistant",
      content: m.content
    }));

  // 4️⃣ Fetch Order History
  const orderHistory = await prisma.order.findMany({
    where: {
      conversationId,
      isDeleted: false,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { summary: true, amount: true, createdAt: true }
  });

  // 5️⃣ Check for recent unconfirmed orders (Ghost orders)
  const pendingOrder = await prisma.order.findFirst({
    where: {
      conversationId,
      status: OrderStatus.BOT_CREATED_ORDER,
      isDeleted: false,
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 mins
    }
  });

  const controlFlags: any = {
    force_mode: pendingOrder ? "CONFIRM_ORDER" : "AUTO",
    menu_allowed: true,
    history_allowed: !pendingOrder // 🛡️ HIDE history when confirming new order to prevent confusion
  };

  // 6️⃣ Generate AI reply grounded to structured menu
  const reply = await generateBotReply(
    userMessage,
    businessName,
    businessType,
    structuredMenu,
    historyContext,
    orderHistory as any,
    conversation.lead,
    modality,
    {
      ...controlFlags,
      pendingOrder: pendingOrder ? { summary: pendingOrder.summary, amount: pendingOrder.amount } : undefined
    },
    detectedLanguage
  );

  return reply;
}
