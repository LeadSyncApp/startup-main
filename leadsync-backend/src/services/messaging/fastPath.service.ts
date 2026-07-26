import { prisma, getTenantPrismaContext } from "../../lib/prisma";
import { TelegramTransportService } from "../transport/telegramTransport.service";
import { webhookPersistenceService } from "../infrastructure/webhookPersistence.service";
import { Channel, ConversationStatus, MessageSender } from "@prisma/client";
import { safeEmitConversationUpdate, emitToConversation } from "../../lib/socket";

// In-memory deduplication set (TTL 60s) to prevent duplicate replies on Telegram webhook retries
const processedUpdateIds = new Set<string>();
setInterval(() => {
  processedUpdateIds.clear();
}, 60_000).unref();

// In-memory cache of conversations known to be in HUMAN mode (TTL 30s)
const humanModeConversationsCache = new Map<string, { mode: string; cachedAt: number }>();

const FAST_PATH_PATTERNS = [
  { pattern: /^(hi|hello|hey|hey there|helloo|howdy|good morning|good afternoon|good evening)$/i, category: "greeting" },
  { pattern: /^(ok|okay|k|got it|sure|thanks|thank you|ty|thx|thankyou|okie|okies)$/i, category: "acknowledgment" },
  { pattern: /^(bye|goodbye|cya|see you|see ya|take care|talk later|gotta go)$/i, category: "farewell" },
  { pattern: /^(yes|no|yeah|nope|yep|nah|yup|nahi|haan|haa)$/i, category: "yesno" },
];

const FAST_PATH_RESPONSES: Record<string, string[]> = {
  greeting: ["Hello! How can I help you today?", "Hi there! What can I do for you?", "Hey! How can I assist you?"],
  acknowledgment: ["You're welcome! Let me know if you need anything else.", "Happy to help! Anything else?", "Got it! Feel free to ask if you have more questions."],
  farewell: ["Goodbye! Have a great day!", "Take care! Reach out anytime.", "Bye! See you next time!"],
  yesno: ["I see. Could you tell me more about what you'd like to order?", "Alright! Let me know how I can help.", "Thanks for letting me know! Can I help with anything else?"],
};

export class FastPathService {
  /**
   * Evaluates if an inbound message is eligible for instant fast-path dispatch.
   * If matched, dispatches the Telegram HTTP response IMMEDIATELY and offloads all DB bookkeeping
   * to background non-blocking tasks.
   */
  public static async tryHandleFastPath(params: {
    companyId: string;
    rawPayload: any;
  }): Promise<{ handled: boolean; category?: string; response?: string }> {
    const { companyId, rawPayload } = params;
    if (!rawPayload || !rawPayload.message || !rawPayload.message.text) {
      return { handled: false };
    }

    const updateId = rawPayload.update_id ? String(rawPayload.update_id) : null;
    if (updateId) {
      if (processedUpdateIds.has(updateId)) {
        return { handled: true }; // Already handled duplicate webhook payload
      }
      processedUpdateIds.add(updateId);
    }

    const text = (rawPayload.message.text || "").trim();
    let fastPathCategory: string | null = null;
    let fastPathResponse: string | null = null;

    for (const entry of FAST_PATH_PATTERNS) {
      if (entry.pattern.test(text)) {
        fastPathCategory = entry.category;
        const responses = FAST_PATH_RESPONSES[entry.category];
        fastPathResponse = responses[Math.floor(Math.random() * responses.length)];
        break;
      }
    }

    if (!fastPathCategory || !fastPathResponse) {
      return { handled: false };
    }

    const chatId = String(rawPayload.message.chat.id);
    const contactName = rawPayload.message.from?.first_name || "User";

    // Fast check: verify if the conversation for this contact is currently in HUMAN mode
    const cacheKey = `${companyId}:${chatId}`;
    const cachedMode = humanModeConversationsCache.get(cacheKey);
    if (cachedMode && Date.now() - cachedMode.cachedAt < 30_000 && cachedMode.mode === "HUMAN") {
      // In HUMAN mode — skip automated fast path reply so human agent handles it
      return { handled: false };
    }

    // ⚡ STEP 1: IMMEDIATE OUTBOUND DISPATCH TO TELEGRAM API (< 300ms)
    const dispatchStart = Date.now();
    try {
      await TelegramTransportService.sendOutboundPayload(
        companyId,
        chatId,
        fastPathResponse
      );
      const dispatchMs = Date.now() - dispatchStart;
      console.log(`⚡ [FastPath] Instant Telegram dispatch completed in ${dispatchMs}ms for message "${text}" -> "${fastPathResponse}"`);
    } catch (err: any) {
      console.error(`❌ [FastPath] Telegram immediate dispatch failed:`, err.message);
      // If immediate dispatch fails, allow fallback to standard worker pipeline
      return { handled: false };
    }

    // ⚡ STEP 2: ASYNCHRONOUS BACKGROUND DB BOOKKEEPING & REALTIME NOTIFICATIONS
    const bgTask = (async () => {
      try {
        // 1. Async raw webhook persistence
        await webhookPersistenceService.persist("TELEGRAM", companyId, updateId, rawPayload).catch(() => {});

        const tenantPrisma = getTenantPrismaContext(companyId);

        // 2. Resolve/Create Lead
        let lead = await prisma.lead.findFirst({
          where: { companyId, contact: chatId, channel: Channel.TELEGRAM, deletedAt: null },
          include: { conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 1 } }
        });

        if (!lead) {
          lead = await tenantPrisma.lead.create({
            data: { companyId, contact: chatId, channel: Channel.TELEGRAM, name: contactName },
            include: { conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 1 } }
          });
        }

        // 3. Resolve/Create Conversation
        let conversation = (lead.conversations || [])[0];
        if (!conversation || conversation.lifecycleStatus === "archived") {
          conversation = await tenantPrisma.conversation.create({
            data: {
              channel: Channel.TELEGRAM,
              companyId,
              status: ConversationStatus.OPEN,
              leadId: lead.id,
              isReturningCustomer: !!conversation
            }
          });
        }

        if (!conversation || !conversation.id) {
          console.error(`⚠️ [FastPath] Could not resolve valid conversation for lead ${lead.id}`);
          return;
        }

        // Update HUMAN mode cache
        if (conversation.mode) {
          humanModeConversationsCache.set(cacheKey, { mode: conversation.mode, cachedAt: Date.now() });
        }

        // 4. Create Inbound & Outbound Messages atomically
        const { clientMsg, botMsg } = await tenantPrisma.$transaction(
          async (tx: any) => {
            const clientMsg = await tx.message.create({
              data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
            });
            const botMsg = await tx.message.create({
              data: { companyId, conversationId: conversation.id, content: fastPathResponse, sender: MessageSender.BOT, deliveryStatus: "SENT" }
            });
            await tx.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } });
            await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
            return { clientMsg, botMsg };
          },
          { timeout: 30000, maxWait: 30000 }
        );

        // 5. Emit Socket Updates for real-time CRM UI
        emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
        emitToConversation(conversation.id, "new_message", { ...botMsg, conversationId: conversation.id });
        safeEmitConversationUpdate(conversation, "conversation_updated", {
          conversationId: conversation.id,
          lastContent: fastPathResponse,
          updatedAt: new Date().toISOString()
        });

      } catch (bgErr: any) {
        console.error("⚠️ [FastPath] Async background persistence error:", bgErr.message);
      }
    })();

    pendingBackgroundTasks.add(bgTask);
    bgTask.finally(() => pendingBackgroundTasks.delete(bgTask));

    return { handled: true, category: fastPathCategory, response: fastPathResponse };
  }

  public static async flushPendingBackgroundTasks(): Promise<void> {
    if (pendingBackgroundTasks.size > 0) {
      await Promise.all(Array.from(pendingBackgroundTasks));
    }
  }
}

const pendingBackgroundTasks = new Set<Promise<void>>();
