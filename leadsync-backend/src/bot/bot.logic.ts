import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateShopReply } from "../services/ai.service";
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
  }) as any;

  if (!conversation || conversation.mode !== "BOT") {
    return null;
  }

  // 2️⃣ Fetch company configuration
  const company = await (prisma.company as any).findUnique({
    where: { id: conversation.companyId },
    select: {
      name: true,
      botBusinessType: true,
      botStructuredMenu: true,
      botLearnedContext: true,
      botPolicies: true,
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


  // 5.6️⃣ Resolve Session & Retrieval (Phase 1 & 2C)
  const tenant_id = conversation.companyId;
  const chat_id = conversation.lead.contact;

  // Prefer DB sessionState, fallback to in-memory, fallback to init
  const session_state = (conversation.sessionState as any) || getSession(tenant_id, chat_id);

  const menuSnapshot = getMenuSnapshot(company?.botStructuredMenu);
  const retrievedItems = calculateRetrieval(userMessage, menuSnapshot);

  // 6️⃣ Generate AI reply grounded to structured menu (Phase 1 & 2C)
  const result = await generateShopReply({
    tenant_id,
    user_message: userMessage,
    detected_language: detectedLanguage,
    session_state,
    retrieved_items: retrievedItems,
    learned_knowledge_text: (company as any)?.botLearnedContext || "",
    menu_snapshot: menuSnapshot,
    shop_policies: (company as any)?.botPolicies || "",
    order_history: orderHistory,
    latest_order_status: latestOrder?.status
  });

  // 7️⃣ Update Session (DB + Memory Sync)
  let finalReply = result.replyText;

  if (result.stateUpdates) {
    let updatedState = { ...session_state, ...result.stateUpdates };

    // 🆕 PHASE 2C: Handle Order Finalization
    if (result.orderFinalized && updatedState.cart?.items?.length > 0) {
      try {
        const summaryText = updatedState.cart.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ");
        const newOrder = await (prisma.order as any).create({
          data: {
            companyId: conversation.companyId,
            conversationId: conversation.id,
            leadId: conversation.leadId,
            summary: summaryText,
            items: updatedState.cart.items,
            amount: updatedState.cart.total,
            status: OrderStatus.BOT_CREATED_ORDER, // Ghost Order for Agent approval
            source: "BOT_DETECTED",
            priority: "NORMAL",
          }
        });
        console.log("✅ Ghost Order created from AI finalization.");

        // Step 2: Generate Payment Link (Phase 3 Intro)
        const { paymentService } = await import("../services/payment.service");
        const paymentUrl = await paymentService.createPaymentLink(
          newOrder.id,
          newOrder.amount,
          conversation.lead.contact,
          summaryText
        );

        if (paymentUrl) {
          finalReply += `\n\n💳 Pay here to confirm: ${paymentUrl}`;
        }

        // Clear cart after order is successfully recorded
        updatedState.cart = { items: [], total: 0 };
      } catch (orderErr) {
        console.error("❌ Failed to create ghost order:", orderErr);
      }
    } else if (result.cartCleared) {
      updatedState.cart = { items: [], total: 0 };
    }

    // Update DB
    await (prisma.conversation as any).update({
      where: { id: conversationId },
      data: { sessionState: updatedState }
    });

    // Update fallback memory
    updateSession(tenant_id, chat_id, updatedState);
  }

  return finalReply;
}
