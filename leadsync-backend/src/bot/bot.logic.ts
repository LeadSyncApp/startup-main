import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateShopReply } from "../services/geminiService";
import { getSession, updateSession, getMenuSnapshot, calculateRetrieval } from "../utils/shop-ai.utils";

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
  detectedLanguage: string = "en-IN",
  triggerSource: "typed_command" | "button_click" | "normal_message" = "normal_message",
  command?: string,
  callbackPayload?: string
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
      botLearnedContext: true,
    },
  });

  const businessName = company?.name || "our company";
  const businessType =
    company?.botBusinessType || "general business";

  const structuredMenu = (company?.botStructuredMenu as any) || null;
  const botLearnedContext = company?.botLearnedContext || "";

  // 2.5️⃣ HARDCODED ROUTING (NO AI - STRICT RULES)
  const isTamil = detectedLanguage.startsWith("ta");
  const isHindi = detectedLanguage.startsWith("hi");

  let eventType: "START" | "MENU_BUTTON_CLICK" | "USER_MESSAGE" = "USER_MESSAGE";
  if (command === "/start" || userMessage === "/start") eventType = "START";
  if (callbackPayload === "VIEW_MENU" || userMessage.toLowerCase() === "/menu") eventType = "MENU_BUTTON_CLICK";

  if (eventType === "START") {
    const line1 = `Welcome to ${businessName}.`;
    const line2 = "Tap View Menu to see today's items.";

    return `MESSAGE: ${line1}\n${line2}
BUTTON: View Menu
CALLBACK: VIEW_MENU`;
  }

  if (eventType === "MENU_BUTTON_CLICK") {
    if (!structuredMenu || !structuredMenu.categories || structuredMenu.categories.length === 0) {
      return `MESSAGE: Menu is not available right now. Please tell me what you are looking for.`;
    }

    let menuText = `${businessName} menu:\n`;
    structuredMenu.categories.forEach((cat: any) => {
      menuText += `${cat.name}:\n`;
      cat.items.forEach((item: any) => {
        menuText += `- ${item.name} - ₹${item.price}\n`;
      });
    });
    menuText += "What would you like?";

    return `MESSAGE: ${menuText.trim()}`;
  }

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

  // 5.5️⃣ Fetch latest order for status updates
  const latestOrder = await prisma.order.findFirst({
    where: { conversationId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: { status: true, summary: true }
  });


  // 5.6️⃣ Resolve Session & Retrieval (Phase 1)
  const tenant_id = conversation.companyId;
  const chat_id = conversation.lead.contact;
  const session_state = getSession(tenant_id, chat_id);

  const menuSnapshot = getMenuSnapshot(company?.botStructuredMenu);
  const retrievedItems = calculateRetrieval(userMessage, menuSnapshot);

  // 6️⃣ Generate AI reply grounded to structured menu (Phase 1)
  const result = await generateShopReply({
    tenant_id,
    user_message: userMessage,
    session_state,
    retrieved_items: retrievedItems,
    learned_knowledge_text: company?.botLearnedContext || "",
    menu_snapshot: menuSnapshot,
    shop_policies: "" // Optional policies
  });

  // 7️⃣ Update Session Memory
  if (result.stateUpdates) {
    updateSession(tenant_id, chat_id, result.stateUpdates);
  }

  return result.replyText;
}
