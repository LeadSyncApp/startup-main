
import { prisma } from "../../lib/prisma";

export const webhookPersistenceService = {
  async persist(provider: string, companyId: string, externalId: string | null, payload: any) {
    try {
      return await prisma.incomingWebhook.create({
        data: {
          provider,
          companyId,
          externalId,
          payload,
          status: "PENDING",
        },
      });
    } catch (err) {
      console.error(`❌ [WebhookPersistence] Failed to persist raw webhook:`, err);
      return null;
    }
  },

  async markProcessed(webhookId: string) {
    try {
      await prisma.incomingWebhook.update({
        where: { id: webhookId },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    } catch (err) {
      console.error(`❌ [WebhookPersistence] Failed to mark processed:`, err);
    }
  },

  async markFailed(webhookId: string, error: string) {
    try {
      await prisma.incomingWebhook.update({
        where: { id: webhookId },
        data: { status: "FAILED", error },
      });
    } catch (err) {
      console.error(`❌ [WebhookPersistence] Failed to mark failed:`, err);
    }
  }
};
