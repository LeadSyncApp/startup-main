import { prisma } from "../lib/prisma";
import { OutboundPayload, ChannelType } from "../interfaces/outbound.interface";
import { TelegramTransportService } from "./transport/telegramTransport.service";
import { metaAdapterService } from "./adapters/meta.adapter";
import { Channel, MessageSender } from "@prisma/client";
import { getTenantContext } from "./context/tenantContext.provider";

export class OutboundDispatcher {
  /**
   * Dispatches an outbound message to the correct channel adapter dynamically,
   * and records the delivery status ('SENT' or 'FAILED') atomically back to the message table.
   */
  public async dispatch(payload: OutboundPayload): Promise<{ messageId: string; deliveryStatus: "SENT" | "FAILED"; message?: any }> {
    const { companyId, conversationId, to, channel, content, sender, clientMessageId } = payload;

    // 1. Strict Input Verification
    if (!companyId || typeof companyId !== "string" || companyId.trim() === "") {
      throw new Error("OutboundDispatcher: Invalid or missing companyId");
    }
    if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
      throw new Error("OutboundDispatcher: Invalid or missing conversationId");
    }
    if (!to || typeof to !== "string" || to.trim() === "") {
      throw new Error("OutboundDispatcher: Invalid or missing to (recipient ID)");
    }
    if (!channel || (channel !== "TELEGRAM" && channel !== "WHATSAPP" && channel !== "INSTAGRAM")) {
      throw new Error(`OutboundDispatcher: Invalid or unsupported channel "${channel}"`);
    }
    if (!content || typeof content.text !== "string" || content.text.trim() === "") {
      throw new Error("OutboundDispatcher: Invalid or missing message content.text");
    }

    let deliveryStatus: "SENT" | "FAILED" = "SENT";
    let transportError: Error | null = null;

    // 2. Dispatch through the targeted channel adapter
    try {
      if (channel === "TELEGRAM") {
        await TelegramTransportService.sendOutboundPayload(companyId, to, content.text);
      } else if (channel === "WHATSAPP") {
        await metaAdapterService.sendWhatsAppMessage(companyId, to, content.text);
      } else if (channel === "INSTAGRAM") {
        await metaAdapterService.sendInstagramMessage(companyId, to, content.text);
      }
    } catch (err: unknown) {
      deliveryStatus = "FAILED";
      transportError = err instanceof Error ? err : new Error(String(err));
      console.error(`⚠️ [OutboundDispatcher] Dispatch failed for channel ${channel}. Marking as FAILED. Error: ${transportError.message}`);
    }

    // 3. Channel Enum and Sender Enum Mappings
    const platformMap: Record<"TELEGRAM" | "WHATSAPP" | "INSTAGRAM", Channel> = {
      TELEGRAM: Channel.TELEGRAM,
      WHATSAPP: Channel.WHATSAPP,
      INSTAGRAM: Channel.INSTAGRAM
    };

    const senderName = sender || "SYSTEM";

    // 4. Perform Atomic Database Ledger Entries inside a Transaction
    let createdMessageId: string;
    let createdMessage: any = null;
    try {
const messageSender = payload.sender === "AGENT" ? MessageSender.AGENT 
  : payload.sender === "BOT" ? MessageSender.BOT 
  : MessageSender.SYSTEM;
      const result = await prisma.$transaction(async (tx) => {
        // Create the message with the exact delivery status 'SENT' or 'FAILED'
        const messageData: any = {
          companyId,
          conversationId,
          content: content.text,
          sender: messageSender,
          senderName: payload.senderName || senderName,
          senderId: payload.senderId,
          platform: platformMap[channel],
          deliveryStatus,
          ...(transportError?.message && { deliveryError: transportError.message }),
        };
        // Persist clientMessageId for idempotency if provided
        if (clientMessageId) {
          messageData.clientMessageId = clientMessageId;
        }

        const newMessage = await tx.message.create({
          data: messageData,
        });

        // Update the Conversation summary & timestamp
        await tx.conversation.update({
          where: { id: conversationId, companyId },
          data: {
            updatedAt: new Date()
          }
        });

        console.log(`📊 [OutboundDispatcher] Atomic ledger transaction completed for Message "${newMessage.id}". DeliveryStatus=${deliveryStatus}${clientMessageId ? ` clientMessageId=${clientMessageId}` : ''}`);
        return newMessage;
      });
      createdMessageId = result.id;
      createdMessage = result;
    } catch (dbError: any) {
      const dbMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`❌ [OutboundDispatcher] Database transaction failed while recording message: ${dbMsg}`);
      throw dbError;
    }

    // If there was a transport delivery error, we propagate it after completing the ledger entry
    if (transportError) {
      const dispatchError = new Error(transportError.message);
      (dispatchError as any)._deliveryStatus = deliveryStatus;
      (dispatchError as any)._messageId = createdMessageId;
      (dispatchError as any)._clientMessageId = clientMessageId;
      throw dispatchError;
    }

    return { messageId: createdMessageId, deliveryStatus, message: createdMessage };
  }

  public async sendMessageFrame(channel: ChannelType, externalChatId: string, conversationId: string, payload: { bodyText: string; interactivePayload: any }, sender?: "BOT" | "SYSTEM") {
      const context = getTenantContext();
      if (!context) throw new Error("OutboundDispatcher: No tenant context");
      
      const result = await this.dispatch({
          companyId: context.companyId,
          conversationId,
          to: externalChatId,
          channel: channel,
          content: { text: payload.bodyText },
          sender: sender || "SYSTEM"
      });
      return result;
  }

  public async dispatchAction(validatedIntent: string, aiTurnResult: any) {
    // Basic implementation for now
    const context = getTenantContext();
    if (!context) throw new Error("OutboundDispatcher: No tenant context");
    
    // I need to get the sender info too. For now assume system for actions.
    // This is just a place holder based on the instructions.
  }
}

export const outboundDispatcherService = new OutboundDispatcher();