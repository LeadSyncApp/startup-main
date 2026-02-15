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
  userMessage: string
): Promise<string | null> {
  // 1️⃣ Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.mode !== "BOT") {
    return null;
  }

  // 2️⃣ Fetch company configuration
  const company = await prisma.company.findUnique({
    where: { id: conversation.companyId },
    select: {
      botBusinessType: true,
      botStructuredMenu: true,
    },
  });

  const businessType =
    company?.botBusinessType || "general business";

  const structuredMenu = company?.botStructuredMenu || null;

  // 3️⃣ Generate AI reply grounded to structured menu
  const reply = await generateBotReply(
    userMessage,
    businessType,
    structuredMenu
  );

  return reply;
}
