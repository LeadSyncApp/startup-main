import { prisma } from "../lib/prisma";
import { OrderStatus } from "@prisma/client";
import { generateShopReply } from "../services/ai.service";
import { getSession, updateSession, getMenuSnapshot, calculateRetrieval, createFreshSessionState } from "../utils/shop-ai.utils";

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

  // 2.1 Fetch active BotKnowledge items and merge into learned_knowledge_text
  const knowledgeItems = await (prisma.botKnowledge as any).findMany({
    where: { companyId: conversation.companyId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  let enrichedKnowledge = company?.botLearnedContext || "";
  if (knowledgeItems.length > 0) {
    const knowledgeBlock = knowledgeItems
      .map((k: any) => `[${k.type}] ${k.title}: ${k.content}`)
      .join("\n");
    enrichedKnowledge = `${enrichedKnowledge}\n\n=== MERCHANT KNOWLEDGE BASE ===\n${knowledgeBlock}`;
  }

  // 2.2 Build customer context string
  const lead = conversation.lead;
  const customerCtx = `Customer segment: ${lead.segment || "NEW"} | Total spend: ₹${lead.totalSpend || 0} | Order count: ${lead.orderCount || 0}`;
  enrichedKnowledge = `CUSTOMER PROFILE: ${customerCtx}\n\n${enrichedKnowledge}`;

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
    .filter((m: any) => m.content !== userMessage) // Avoid double current message
    .map((m: any) => ({
      role: m.sender === "CLIENT" ? "user" : "assistant",
      content: m.content
    }));

  // 4️⃣ Fetch Order History (COMPLETED ORDERS ONLY for reference)
  // IMPORTANT: Only send completed orders as history, not active ones
  const orderHistory = await prisma.order.findMany({
    where: {
      conversationId,
      isDeleted: false,
      status: {
        in: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'] // Only completed orders
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { summary: true, amount: true, createdAt: true }
  });

  // 5️⃣ Check for ACTIVE orders (exclude completed from history)
  const activeOrder = await prisma.order.findFirst({
    where: {
      conversationId,
      isDeleted: false,
      status: {
        in: ['BOT_CREATED_ORDER', 'PENDING', 'NEW', 'PROCESSING', 'PREPARING', 'READY', 'SHIPPED']
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 5.5️⃣ Check for recent unconfirmed orders (Ghost orders)
  const pendingOrder = await prisma.order.findFirst({
    where: {
      conversationId,
      status: OrderStatus.BOT_CREATED_ORDER,
      isDeleted: false,
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 mins
    }
  });

  // 5.6️⃣ Fetch latest order for status updates
  const latestOrder = activeOrder || await prisma.order.findFirst({
    where: { conversationId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: { status: true, summary: true }
  });

  // 5.6️⃣ Resolve Session & Retrieval (Phase 1 & 2C)
  const tenant_id = conversation.companyId;
  const chat_id = conversation.lead.contact;

  // Prefer DB sessionState, fallback to in-memory, fallback to init
  const session_state = (conversation.sessionState as any) || getSession(tenant_id, chat_id);

  const menuSnapshot = getMenuSnapshot(company?.botStructuredMenu);
  const retrievedItems = calculateRetrieval(userMessage, menuSnapshot);

  // 6️⃣ Determine if we should start a fresh cart session
  // Clear session state if:
  // - No active orders exist (fresh start)
  // - Last order was completed/cancelled/rejected
  // - User explicitly wants to start fresh (detected by keywords)
  const shouldStartFresh = !activeOrder || 
    (latestOrder && ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(latestOrder.status)) ||
    /\b(start|new|fresh|begin|clear|reset)\b.*\b(order|cart)\b/i.test(userMessage);

  let cleanSessionState = session_state;
  if (shouldStartFresh) {
    // Start with a clean cart state
    cleanSessionState = createFreshSessionState();
    console.log(`🧹 [Bot] Starting fresh cart session for Conv ${conversationId}`);
  }

  // 7️⃣ Generate AI reply grounded to structured menu (Phase 1 & 2C)
  const result = await generateShopReply({
    tenant_id,
    user_message: userMessage,
    detected_language: detectedLanguage,
    session_state: cleanSessionState,
    retrieved_items: retrievedItems,
    learned_knowledge_text: enrichedKnowledge,
    menu_snapshot: menuSnapshot,
    shop_policies: (company as any)?.botPolicies || "",
    order_history: orderHistory, // Only completed orders
    latest_order_status: latestOrder?.status,
    modality: modality
  });

  // 8️⃣ Update Session (DB + Memory Sync)
  let finalReply = result.replyText;

  if (result.stateUpdates) {
    let updatedState = { ...cleanSessionState, ...result.stateUpdates };

    // 🆕 PHASE 2C: Handle Order Finalization
    if (result.orderFinalized && updatedState.cart?.items?.length > 0) {
      try {
        // Validate cart items against menu before creating order
        const menuItems = (company?.botStructuredMenu as any)?.categories?.flatMap((c: any) => c.items) || [];
        const validCartItems = updatedState.cart.items.filter((cartItem: any) => {
          const foundInMenu = menuItems.some((menuItem: any) => 
            menuItem.name.toLowerCase().includes(cartItem.name.toLowerCase()) ||
            cartItem.name.toLowerCase().includes(menuItem.name.toLowerCase())
          );
          if (!foundInMenu) {
            console.log(`🚫 [Bot] Cart item "${cartItem.name}" not found in menu. Filtering out.`);
          }
          return foundInMenu;
        });

        if (validCartItems.length === 0) {
          console.log("🚫 [Bot] No valid items in cart. Skipping order creation.");
          // Clear the cart since all items are invalid
          updatedState.cart = { items: [], total: 0 };
        } else {
          const summaryText = validCartItems.map((i: any) => `${i.quantity}x ${i.name}`).join(", ");
          const totalAmount = validCartItems.reduce((sum: number, item: any) => sum + (item.price || 0) * item.quantity, 0);
          
          const newOrder = await (prisma.order as any).create({
            data: {
              companyId: conversation.companyId,
              conversationId: conversation.id,
              leadId: conversation.leadId,
              summary: summaryText,
              items: validCartItems,
              amount: totalAmount,
              status: OrderStatus.BOT_CREATED_ORDER, // Ghost Order for Agent approval
              source: "BOT_DETECTED",
              priority: "NORMAL",
            }
          });
          console.log("✅ Ghost Order created from AI finalization with validated items.");

          // Clear cart after order is successfully recorded
          updatedState.cart = { items: [], total: 0 };
        }
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
