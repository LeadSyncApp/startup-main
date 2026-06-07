import { prisma } from "../lib/prisma";
import { OrderStatus } from "@prisma/client";
import { safeEmitConversationUpdate, emitToCompany } from "../lib/socket";
import { newOrderArrivalService } from "../services/workflow/newOrderArrival.service";
import { getSession, updateSession, getMenuSnapshot, calculateRetrieval, createFreshSessionState, validateStateUpdates } from "../utils/shop-ai.utils";
import { generateShopReply, generateCustomCommandReply } from "../services/ai/ai.service";
import { recalculateLeadCRM } from "../services/integrations/crm.service";

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

  // 2️⃣ Fetch company configuration & products directly
  const company = await (prisma.company as any).findUnique({
    where: { id: conversation.companyId },
    include: { botConfiguration: true }
  });

  const activeProducts = await (prisma.product as any).findMany({
    where: { companyId: conversation.companyId, isActive: true },
    orderBy: { name: "asc" }
  });

  // Safe logging using absolute path to Workspace root (assumed /)
  try {
    const fs = require("fs");
    const logData = `[LIVE_TRACE] ${new Date().toISOString()} | Conv: ${conversationId} | Products Found: ${activeProducts.length} | first: ${activeProducts[0]?.name || 'none'}\n`;
    fs.appendFileSync("/bot_debug.log", logData);
  } catch (err) {}

  // 2.1 Fetch active BotKnowledge items and merge into learned_knowledge_text
  const knowledgeItems = await (prisma.botKnowledge as any).findMany({
    where: { companyId: conversation.companyId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  let enrichedKnowledge = company?.botConfiguration?.botLearnedContext || "";
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

  const structuredMenu = (company?.botConfiguration?.botStructuredMenu as any) || null;
  const botLearnedContext = company?.botConfiguration?.botLearnedContext || "";

  // 2.3️⃣ STRICT LANGUAGE OVERRIDE
  // Use explicitly selected language by customer if available
  const finalLanguage = lead.preferredLanguage || detectedLanguage || "en-IN";

  // 2.5️⃣ DYNAMIC SHOP COMMAND ROUTING (NO AI - CUSTOM FUNCTIONAL MAPPINGS)
  const botCommands = (company?.botConfiguration?.botCommands as any) || [];

  let cleanCommandName = "";
  if (command !== undefined && command !== null) {
    cleanCommandName = (command as string).replace(/^\//, "").toLowerCase().trim();
  } else if (userMessage.startsWith("/")) {
    cleanCommandName = userMessage.split(" ")[0].replace(/^\//, "").toLowerCase().trim();
  }

  // Find custom action
  const customCmdConfig = botCommands.find((c: any) => c.command === cleanCommandName);
  const matchedAction = customCmdConfig?.action || "none";
  const behaviorMode = customCmdConfig?.behaviorMode || "append";

  // Check callback signals first
  if (callbackPayload === "VIEW_MENU") {
    return handleViewMenuAction(businessName, structuredMenu, undefined, activeProducts);
  }
  if (callbackPayload === "CUSTOM_HANDOFF") {
    cleanCommandName = "help"; // Treat as help command
  }
  if (callbackPayload === "CANCEL_ORDER") {
    cleanCommandName = "clear"; // Treat as clear command
  }
  if (callbackPayload === "CONFIRM_ORDER") {
    // This is handled later by generateShopReply or specific logic
    userMessage = "confirm"; 
  }

  // Check custom action triggers
  if (cleanCommandName !== "") {
    // If override mode is requested to completely override built-in functions with custom message copy
    if (behaviorMode === "override" && customCmdConfig?.customReplyText) {
      const leadName = lead?.name || "Customer";
      const resolvedReply = customCmdConfig.customReplyText.replace(/{name}/g, leadName);

      // Perform background action states side-effects if applicable
      if (matchedAction === "transfer_human") {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { mode: "HUMAN" }
        });

        const fullConversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            lead: { select: { id: true, name: true, contact: true, channel: true } },
            assignedTo: { select: { id: true, name: true } }
          }
        });

        if (fullConversation && (fullConversation as any).id) {
          safeEmitConversationUpdate(fullConversation as any, "conversation_updated", {
            conversationId: (fullConversation as any).id,
            lastMessage: "🔄 Handed off chat to a human representative",
            updatedAt: new Date(),
            conversation: fullConversation as any
          });
        }
      } else if (matchedAction === "clear_cart") {
        const freshState = createFreshSessionState();
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { sessionState: freshState as any }
        });
        updateSession(conversation.companyId, lead.contact, freshState);
      }

      return `MESSAGE: ${resolvedReply}`;
    }

    // Default / Append/Enhance Mode (AI Interpreted)
    if (matchedAction === "start" || (cleanCommandName === "start" && matchedAction === "none")) {
      if (customCmdConfig?.customReplyText && behaviorMode !== "override") {
        const baseStartReply = handleStartAction(lead, businessName, undefined);
        const sketch = customCmdConfig?.lastCompiledReply || baseStartReply;
        
        const aiResult = await generateCustomCommandReply(
          sketch,
          customCmdConfig.customReplyText,
          lead?.name || "Customer",
          businessName,
          finalLanguage
        );

        // Stateful Persistence: Sync the newly compiled structure back to the company configuration
        if (aiResult && aiResult !== customCmdConfig.lastCompiledReply) {
          const updatedCommands = botCommands.map((c: any) => 
            c.command === cleanCommandName ? { ...c, lastCompiledReply: aiResult } : c
          );
          await prisma.botConfiguration.update({
            where: { companyId: conversation.companyId },
            data: { botCommands: updatedCommands }
          });
        }

        return aiResult.replace(/{name}/g, lead?.name || "Customer");
      }
      return handleStartAction(lead, businessName, customCmdConfig?.customReplyText);
    }

    if (matchedAction === "view_menu" || (cleanCommandName === "menu" && matchedAction === "none")) {
      if (customCmdConfig?.customReplyText && behaviorMode !== "override") {
        const baseMenuReply = handleViewMenuAction(businessName, structuredMenu, undefined, activeProducts);
        const sketch = customCmdConfig?.lastCompiledReply || baseMenuReply;

        const aiResult = await generateCustomCommandReply(
          sketch,
          customCmdConfig.customReplyText,
          lead?.name || "Customer",
          businessName,
          finalLanguage
        );

        // Stateful Persistence
        if (aiResult && aiResult !== customCmdConfig.lastCompiledReply) {
          const updatedCommands = botCommands.map((c: any) => 
            c.command === cleanCommandName ? { ...c, lastCompiledReply: aiResult } : c
          );
          await prisma.botConfiguration.update({
            where: { companyId: conversation.companyId },
            data: { botCommands: updatedCommands }
          });
        }

        return aiResult.replace(/{name}/g, lead?.name || "Customer");
      }
      return handleViewMenuAction(businessName, structuredMenu, customCmdConfig?.customReplyText, activeProducts);
    }

    if (customCmdConfig?.customReplyText && matchedAction === "none") {
      if (behaviorMode !== "override") {
        const baseNoneReply = "MESSAGE: Hello! How can I assist you?";
        const sketch = customCmdConfig?.lastCompiledReply || baseNoneReply;

        const aiResult = await generateCustomCommandReply(
          sketch,
          customCmdConfig.customReplyText,
          lead?.name || "Customer",
          businessName,
          finalLanguage
        );

        // Stateful Persistence
        if (aiResult && aiResult !== customCmdConfig.lastCompiledReply) {
          const updatedCommands = botCommands.map((c: any) => 
            c.command === cleanCommandName ? { ...c, lastCompiledReply: aiResult } : c
          );
          await prisma.botConfiguration.update({
            where: { companyId: conversation.companyId },
            data: { botCommands: updatedCommands }
          });
        }

        return aiResult.replace(/{name}/g, lead?.name || "Customer");
      }
      return `MESSAGE: ${customCmdConfig.customReplyText.replace(/{name}/g, lead?.name || "Customer")}`;
    }

    if (matchedAction === "transfer_human") {
      const customReply = customCmdConfig?.customReplyText;
      const respText = customReply 
        ? customReply.replace(/{name}/g, lead?.name || "Customer")
        : `🔄 Switched chat to Human Agent mode. A live representative will review your request and get back to you shortly!`;

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { mode: "HUMAN" }
      });

      const fullConversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          lead: { select: { id: true, name: true, contact: true, channel: true } },
          assignedTo: { select: { id: true, name: true } }
        }
      });

      if (fullConversation) {
        safeEmitConversationUpdate(fullConversation as any, "conversation_updated", {
          conversationId: (fullConversation as any).id,
          lastMessage: "🔄 Handed off chat to a human representative",
          updatedAt: new Date(),
          conversation: fullConversation as any
        });
      }

      return `MESSAGE: ${respText}`;
    }

    if (matchedAction === "clear_cart") {
      const customReply = customCmdConfig?.customReplyText;
      const respText = customReply
        ? customReply.replace(/{name}/g, lead?.name || "Customer")
        : `🧹 Your conversation session and shopping cart have been reset successfully! Any unconfirmed elements were removed. Feel free to start fresh!`;

      const freshState = createFreshSessionState();
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { sessionState: freshState as any }
      });
      updateSession(conversation.companyId, lead.contact, freshState);

      return `MESSAGE: ${respText}`;
    }
  }

  // Fallback for typed commands
  if (userMessage.toLowerCase() === "/menu") {
    return handleViewMenuAction(businessName, structuredMenu, undefined, activeProducts);
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
    orderBy: { createdAt: 'desc' },
    include: { orderItems: true }
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

  const menuSnapshot = getMenuSnapshot(company?.botConfiguration?.botStructuredMenu, activeProducts);
  const retrievedItems = calculateRetrieval(userMessage, menuSnapshot);

  // 6️⃣ Resolve Session State
  let cleanSessionState = session_state || createFreshSessionState();

  // 7️⃣ Generate AI reply grounded to structured menu (Phase 1 & 2C)
  const result = await generateShopReply({
    tenant_id,
    user_message: userMessage,
    detected_language: finalLanguage,
    session_state: cleanSessionState,
    retrieved_items: retrievedItems,
    learned_knowledge_text: enrichedKnowledge,
    menu_snapshot: menuSnapshot,
    shop_policies: company?.botConfiguration?.botPolicies || "",
    order_history: orderHistory, // Only completed orders
    latest_order_status: latestOrder?.status,
    modality: modality,
    bot_commands: botCommands,
    active_order: activeOrder // Pass the active order context so the AI can modify items
  });

  // 8️⃣ Update Session (DB + Memory Sync)
  let finalReply = result.replyText;

  if (result.stateUpdates) {
    let updatedState = validateStateUpdates(result.stateUpdates, cleanSessionState);

    // 🆕 SYNC CLIENT-SIDE ACTIVE/PENDING ORDERS LIVE (Phase 2C Real-time updates)
    // Find absolute latest unconfirmed/active order for this conversation
    const activeUnconfirmed = await prisma.order.findFirst({
      where: {
        conversationId,
        isDeleted: false,
        status: { in: ['BOT_CREATED_ORDER', 'PENDING', 'NEW', 'PROCESSING', 'PREPARING', 'READY', 'SHIPPED'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (activeUnconfirmed && updatedState.cart?.items) {
      if (updatedState.cart.items.length > 0) {
        const summaryText = updatedState.cart.items.map((i: any) => `${i.name} x${i.quantity}`).join(", ");
        const totalAmount = updatedState.cart.items.reduce((sum: number, item: any) => sum + (item.price || 0) * item.quantity, 0);

        const currentItemsStr = JSON.stringify((activeUnconfirmed as any).items || []);
        const newItemsStr = JSON.stringify(updatedState.cart.items || []);

        if (currentItemsStr !== newItemsStr) {
          const updatedOrder = await (prisma.order as any).update({
            where: { id: (activeUnconfirmed as any).id },
            data: {
              items: updatedState.cart.items as any,
              summary: summaryText,
              amount: totalAmount,
            }
          });
          console.log(`📡 [Bot] Live-synced updated cart items to active order ${(activeUnconfirmed as any).id}`);

          // Recalculate CRM metrics for this lead
          await recalculateLeadCRM(conversation.leadId, conversation.companyId).catch(err => console.error("CRM Recalc failed:", err));

          // Emit Socket update events instantly to keep the Agent dashboard in perfect, real-time sync!
          safeEmitConversationUpdate(conversation, "order_updated", updatedOrder);
          emitToCompany(conversation.companyId, "order_updated", updatedOrder);
        }
      }
    }

    if (updatedState.cart?.items?.length > 0) {
      // Keep the AI model's natural, contextual grounding reply intact, and append the interactive Call-To-Action buttons at the bottom.
      finalReply = `${result.replyText}\n\nBUTTON: Confirm Order\nCALLBACK: CONFIRM_ORDER\nBUTTON: Cancel Order\nCALLBACK: CANCEL_ORDER`;
    }

    // 🆕 PHASE 2C: Handle Order Finalization (kept for compatibility, though buttons handle the finalization)
    if (result.orderFinalized && updatedState.cart?.items?.length > 0) {
      try {
        // Validate cart items against menu before creating order
        let menuItems = (company?.botConfiguration?.botStructuredMenu as any)?.categories?.flatMap((c: any) => c.items) || [];
        if (menuItems.length === 0 && company.products && company.products.length > 0) {
            menuItems = company.products;
        }
        
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
          
          // 🆕 UNIFIED WORKFLOW: Route ALL orders through New Order Arrivals
          // This bypasses direct order creation and ensures universal intake
          const orderArrival = await newOrderArrivalService.processNewOrderArrival({
            companyId: conversation.companyId,
            conversationId: conversation.id,
            leadId: conversation.leadId,
            summary: summaryText,
            amount: totalAmount,
            items: validCartItems.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price || 0
            })),
            source: "BOT_DETECTED",
            priority: totalAmount > 0 ? "URGENT" : "NORMAL",
            detectedLanguage: finalLanguage
          });
          
          console.log("✅ Order routed through unified New Order Arrivals workflow.");

          // Clear cart after order is successfully recorded
          updatedState.cart = { items: [], total: 0 };
        }
      } catch (orderErr) {
        console.error("❌ Failed to create ghost order:", orderErr);
      }
    } else if (result.cartCleared) {
      updatedState.cart = { items: [], total: 0 };

      // Cancel active unconfirmed order if cart was cleared/cancelled
      const activeUnconfirmedToCancel = await prisma.order.findFirst({
        where: {
          conversationId,
          isDeleted: false,
          status: { in: ['BOT_CREATED_ORDER', 'PENDING', 'NEW'] }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (activeUnconfirmedToCancel) {
        const cancelledOrder = await (prisma.order as any).update({
          where: { id: (activeUnconfirmedToCancel as any).id },
          data: { status: 'CANCELLED' }
        });
        console.log(`📡 [Bot] Cancelled active unconfirmed order ${(activeUnconfirmedToCancel as any).id} because the customer cleared their cart`);
        safeEmitConversationUpdate(conversation, "order_updated", cancelledOrder);
        emitToCompany(conversation.companyId, "order_updated", cancelledOrder);
      }
    }

    if (result.humanHandoffRequested) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { mode: "HUMAN" }
      });

      const fullConversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          lead: { select: { id: true, name: true, contact: true, channel: true } },
          assignedTo: { select: { id: true, name: true } }
        }
      });

      if (fullConversation) {
        safeEmitConversationUpdate(fullConversation as any, "conversation_updated", {
          conversationId: (fullConversation as any).id,
          lastMessage: "🔄 Handed off chat to a human representative",
          updatedAt: new Date(),
          conversation: fullConversation as any
        });
      }
      finalReply += "\n\n🔄 A human agent has been requested. We will connect you shortly.";
    }

    // Update DB and emit socket updates so everything syncs live in the Agent dashboard instantly!
    try {
      const updatedConv = await prisma.conversation.update({
        where: { id: conversationId },
        data: { sessionState: updatedState as any },
        include: {
          lead: { select: { id: true, name: true, contact: true, channel: true } },
          assignedTo: { select: { id: true, name: true } }
        }
      });
      
      safeEmitConversationUpdate(updatedConv as any, "conversation_updated", {
        conversationId: (updatedConv as any).id,
        lastMessage: result.replyText,
        updatedAt: new Date(),
        conversation: updatedConv as any
      });
    } catch (e) {
      console.error("❌ Failed to update sessionState in DB:", e);
    }

    // Update fallback memory
    updateSession(tenant_id, chat_id, updatedState);
  }

  return finalReply;
}

/* =====================================================
   ACTION HELPER ROUTINES
===================================================== */
function handleStartAction(lead: any, businessName: string, customReply?: string): string {
  const leadName = lead?.name || "Customer";
  const welcomeText = customReply 
    ? customReply.replace(/{name}/g, leadName) 
    : `👋 Welcome to ${businessName}, ${leadName}!\nHow can we help you today? Please tap an option below:`;

  return `MESSAGE: ${welcomeText}
BUTTON: View Menu
CALLBACK: VIEW_MENU
BUTTON: Select preferred Language
CALLBACK: lang_selection_prompt`;
}

function handleViewMenuAction(businessName: string, structuredMenu: any, customReply?: string, products?: any[]): string {
  try {
    const fs = require("fs");
    fs.appendFileSync("/bot_debug.log", `[handleViewMenuAction] Called. businessName: ${businessName}, products length: ${products?.length || 0}\n`);
  } catch (err) {}

  const menu = getMenuSnapshot(structuredMenu, products);

    if (!menu || !menu.categories || menu.categories.length === 0) {
      try {
        const fs = require("fs");
        fs.appendFileSync("/bot_debug.log", `[handleViewMenuAction] Menu has 0 categories. returning error msg.\n`);
      } catch (err) {}
      return `MESSAGE: BOT ERROR: Menu not configured (Found ${products?.length || 0} products). Please tell us what you're looking for!`;
    }

  let menuText = customReply ? `${customReply}\n\n` : `📖 *${businessName} Catalog Menu*:\n\n`;
  menu.categories.forEach((cat: any) => {
    menuText += `*${cat.name}*:\n`;
    cat.items.forEach((item: any) => {
      menuText += `- ${item.name} - ₹${item.price}\n`;
    });
    menuText += "\n";
  });
  menuText += "What would you like to order? Type items to add them to your cart.";

  return `MESSAGE: ${menuText.trim()}`;
}
