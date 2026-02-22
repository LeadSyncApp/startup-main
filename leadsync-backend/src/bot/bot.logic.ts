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
    },
  });

  const businessName = company?.name || "our company";
  const businessType =
    company?.botBusinessType || "general business";

  const structuredMenu = (company?.botStructuredMenu as any) || null;

  // 2.5️⃣ HARDCODED ROUTING (NO AI)
  const isTamil = detectedLanguage.startsWith("ta");
  const isHindi = detectedLanguage.startsWith("hi");

  if (command === "/start" || userMessage === "/start") {
    const welcomeMsg = isTamil
      ? `MESSAGE: 👋 ${businessName}-ற்கு வரவேற்கிறோம்! இன்று கிடைக்கும் பொருட்களைக் காண கீழே உள்ள பொத்தானைத் தட்டவும்.`
      : isHindi
        ? `MESSAGE: 👋 ${businessName} में आपका स्वागत है! आज के उत्पादों को देखने के लिए नीचे दिए गए बटन पर टैप करें।`
        : `MESSAGE: 👋 Welcome to ${businessName}! Tap below to view our products.`;

    const buttonText = isTamil ? "🛍 மெனுவைக் காண்க (View Menu)" : isHindi ? "🛍 मेनू देखें (View Menu)" : "🛍 View Menu";

    return `${welcomeMsg}
BUTTON: ${buttonText}
CALLBACK: VIEW_MENU`;
  }

  if (callbackPayload === "VIEW_MENU" || userMessage.toLowerCase() === "/menu") {
    if (!structuredMenu || !structuredMenu.categories || structuredMenu.categories.length === 0) {
      return isTamil
        ? `MESSAGE: மன்னிக்கவும், ${businessName}-இல் தற்போது பொருட்கள் எதுவும் இல்லை. நான் வேறு எவ்வகையில் உதவ முடியும்?`
        : isHindi
          ? `MESSAGE: क्षमा करें, ${businessName} में फिलहाल कोई आइटम उपलब्ध नहीं है। मैं आपकी और कैसे मदद कर सकता हूँ?`
          : `MESSAGE: Sorry, there are no items available right now at ${businessName}. How else can I help you?`;
    }

    let menuTitle = isTamil ? `🛍 *${businessName} - தயாரிப்பு பட்டியல் (Product Catalog)*` : isHindi ? `🛍 *${businessName} - उत्पाद सूची (Product Catalog)*` : `🛍 *Today's Menu at ${businessName}:*`;
    let menuFooter = isTamil ? "நீங்கள் எதை ஆர்டர் செய்ய விரும்புகிறீர்கள்?" : isHindi ? "Aap kya order karna chahenge?" : "What would you like to order?";

    let menuText = `${menuTitle}\n\n`;
    structuredMenu.categories.forEach((cat: any) => {
      menuText += `*${cat.name.toUpperCase()}*\n`;
      cat.items.forEach((item: any) => {
        menuText += `- ${item.name}: ₹${item.price}\n`;
      });
      menuText += "\n";
    });
    menuText += menuFooter;

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

  const isMenuRequest = /menu|list|items|show|what|product|porutkal|patti/i.test(userMessage.toLowerCase());

  const controlFlags: any = {
    force_mode: pendingOrder ? "CONFIRM_ORDER" : (isMenuRequest ? "BROWSE_MENU" : "AUTO"),
    menu_allowed: true,
    history_allowed: !pendingOrder && !isMenuRequest, // 🛡️ CRITICAL: Disable history if ordering or asking for menu
    command,
    trigger_source: triggerSource,
    callback_payload: callbackPayload,
    latest_order: latestOrder
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
