"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchToBot = switchToBot;
exports.switchToHuman = switchToHuman;
exports.handleBotMessage = handleBotMessage;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const ai_service_1 = require("../services/ai.service");
const shop_ai_utils_1 = require("../utils/shop-ai.utils");
/* =====================================================
   SWITCH TO BOT MODE
===================================================== */
async function switchToBot(conversationId) {
    return prisma_1.prisma.conversation.update({
        where: { id: conversationId },
        data: { mode: "BOT" },
    });
}
/* =====================================================
   SWITCH TO HUMAN MODE
===================================================== */
async function switchToHuman(conversationId) {
    return prisma_1.prisma.conversation.update({
        where: { id: conversationId },
        data: { mode: "HUMAN" },
    });
}
/* =====================================================
   HANDLE BOT MESSAGE (MULTI-TENANT + STRUCTURED MENU)
===================================================== */
async function handleBotMessage(conversationId, userMessage, modality = "text", detectedLanguage = "en-IN", triggerSource = "normal_message", command, callbackPayload) {
    // 1️⃣ Get conversation with Lead (Customer Profile)
    const conversation = await prisma_1.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { lead: true }
    });
    if (!conversation || conversation.mode !== "BOT") {
        return null;
    }
    // 2️⃣ Fetch company configuration
    const company = await prisma_1.prisma.company.findUnique({
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
    const businessType = company?.botBusinessType || "general business";
    const structuredMenu = company?.botStructuredMenu || null;
    const botLearnedContext = company?.botLearnedContext || "";
    // 2.5️⃣ HARDCODED ROUTING (NO AI - STRICT RULES)
    const isTamil = detectedLanguage.startsWith("ta");
    const isHindi = detectedLanguage.startsWith("hi");
    let eventType = "USER_MESSAGE";
    if (command === "/start" || userMessage === "/start")
        eventType = "START";
    if (callbackPayload === "VIEW_MENU" || userMessage.toLowerCase() === "/menu")
        eventType = "MENU_BUTTON_CLICK";
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
        structuredMenu.categories.forEach((cat) => {
            menuText += `${cat.name}:\n`;
            cat.items.forEach((item) => {
                menuText += `- ${item.name} - ₹${item.price}\n`;
            });
        });
        menuText += "What would you like?";
        return `MESSAGE: ${menuText.trim()}`;
    }
    // 3️⃣ Fetch History (Context)
    const history = await prisma_1.prisma.message.findMany({
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
    const orderHistory = await prisma_1.prisma.order.findMany({
        where: {
            conversationId,
            isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { summary: true, amount: true, createdAt: true }
    });
    // 5️⃣ Check for recent unconfirmed orders (Ghost orders)
    const pendingOrder = await prisma_1.prisma.order.findFirst({
        where: {
            conversationId,
            status: client_1.OrderStatus.BOT_CREATED_ORDER,
            isDeleted: false,
            createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 mins
        }
    });
    // 5.5️⃣ Fetch latest order for status updates
    const latestOrder = await prisma_1.prisma.order.findFirst({
        where: { conversationId, isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: { status: true, summary: true }
    });
    // 5.6️⃣ Resolve Session & Retrieval (Phase 1 & 2C)
    const tenant_id = conversation.companyId;
    const chat_id = conversation.lead.contact;
    // Prefer DB sessionState, fallback to in-memory, fallback to init
    const session_state = conversation.sessionState || (0, shop_ai_utils_1.getSession)(tenant_id, chat_id);
    const menuSnapshot = (0, shop_ai_utils_1.getMenuSnapshot)(company?.botStructuredMenu);
    const retrievedItems = (0, shop_ai_utils_1.calculateRetrieval)(userMessage, menuSnapshot);
    // 6️⃣ Generate AI reply grounded to structured menu (Phase 1 & 2C)
    const result = await (0, ai_service_1.generateShopReply)({
        tenant_id,
        user_message: userMessage,
        detected_language: detectedLanguage,
        session_state,
        retrieved_items: retrievedItems,
        learned_knowledge_text: company?.botLearnedContext || "",
        menu_snapshot: menuSnapshot,
        shop_policies: company?.botPolicies || "",
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
                const summaryText = updatedState.cart.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
                const newOrder = await prisma_1.prisma.order.create({
                    data: {
                        companyId: conversation.companyId,
                        conversationId: conversation.id,
                        leadId: conversation.leadId,
                        summary: summaryText,
                        items: updatedState.cart.items,
                        amount: updatedState.cart.total,
                        status: client_1.OrderStatus.BOT_CREATED_ORDER, // Ghost Order for Agent approval
                        source: "BOT_DETECTED",
                        priority: "NORMAL",
                    }
                });
                console.log("✅ Ghost Order created from AI finalization.");
                // Step 2: Generate Payment Link (Phase 3 Intro)
                const { paymentService } = await Promise.resolve().then(() => __importStar(require("../services/payment.service")));
                const paymentUrl = await paymentService.createPaymentLink(newOrder.id, newOrder.amount, conversation.lead.contact, summaryText);
                if (paymentUrl) {
                    finalReply += `\n\n💳 Pay here to confirm: ${paymentUrl}`;
                }
                // Clear cart after order is successfully recorded
                updatedState.cart = { items: [], total: 0 };
            }
            catch (orderErr) {
                console.error("❌ Failed to create ghost order:", orderErr);
            }
        }
        else if (result.cartCleared) {
            updatedState.cart = { items: [], total: 0 };
        }
        // Update DB
        await prisma_1.prisma.conversation.update({
            where: { id: conversationId },
            data: { sessionState: updatedState }
        });
        // Update fallback memory
        (0, shop_ai_utils_1.updateSession)(tenant_id, chat_id, updatedState);
    }
    return finalReply;
}
