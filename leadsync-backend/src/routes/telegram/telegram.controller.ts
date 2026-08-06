import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { ProviderAdapterFactory } from "../../adapters/provider.factory";
import { pgBossService } from "../../services/infrastructure/pgboss/pgboss.service";
import { Channel } from "../../interfaces/messaging.interface";
import { decryptSecret } from "../../utils/encryption";
import { webhookPersistenceService } from "../../services/infrastructure/webhookPersistence.service";
import { FastPathService } from "../../services/messaging/fastPath.service";

const router = Router();

/**
 * ⚡ DETERMINISTIC EDGE ROUTE MIDDLEWARE
 * Converts an $O(N)$ memory search into a constant-time $O(1)$ indexed query block.
 */
router.post("/webhook/telegram/:companyId", async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const signatureSecret = req.headers["x-telegram-bot-api-secret-token"];

  if (!companyId || !signatureSecret) {
    return res.status(200).json({ status: "ignored", message: "Missing explicit perimeter routing assertions." });
  }

  try {
    // Exact, direct lookup using unique constraints and database indices
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, telegramWebhookSecret: true, telegramBotToken: true }
    });

    if (!company || !company.telegramWebhookSecret) {
      console.error(`🚨 [Security Breach Alert] Unauthorized webhook payload injection attempted on Company ID: ${companyId}`);
      return res.status(200).json({ status: "unauthorized", message: "Authentication validation dropped." });
    }

    const decryptedSecret = decryptSecret(company.telegramWebhookSecret);
    if (decryptedSecret !== signatureSecret) {
      console.error(`🚨 [Security Breach Alert] Unauthorized webhook payload injection attempted on Company ID: ${companyId} - Secret signature mismatch.`);
      return res.status(200).json({ status: "unauthorized", message: "Authentication validation dropped." });
    }



    const adapter = ProviderAdapterFactory.getAdapter("telegram");
    const standardizedFrame = adapter.normalizePayload(req.body);

    if (!standardizedFrame) {
      return res.status(200).json({ status: "ignored", message: "Empty or non-actionable transmission data." });
    }

    standardizedFrame.companyId = company.id;

    // Persist webhook payload in database asynchronously
    webhookPersistenceService.persist(
      "TELEGRAM",
      company.id,
      req.body?.update_id ? String(req.body.update_id) : null,
      req.body || {}
    ).catch((e) => console.warn("Failed to persist webhook metadata:", e));

    // Direct O(1) queueing to the background worker layer
    const boss = pgBossService.getBoss();
    await boss.send("webhook.process", standardizedFrame);

    return res.status(202).json({ status: "accepted" });

  } catch (error) {
    console.error(`[EdgeWebhookFailure] Failed to ingest message for tenant ${companyId}:`, error);
    return res.status(200).json({ status: "error", message: "Internal system boundary exception managed." });
  }
});

/**
 * ⚡ COMPATIBILITY EDGE ROUTE
 * Maps webhook requests under the simple '/webhook/:companyId' path seamlessly.
 */
router.post("/webhook/:companyId", async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const signatureSecret = req.headers["x-telegram-bot-api-secret-token"];

  if (!companyId || !signatureSecret) {
    return res.status(200).json({ status: "ignored", message: "Missing explicit perimeter routing assertions." });
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, telegramWebhookSecret: true, telegramBotToken: true }
    });

    if (!company || !company.telegramWebhookSecret) {
      console.error(`🚨 [Security Breach Alert] Unauthorized webhook payload injection attempted on Company ID: ${companyId}`);
      return res.status(200).json({ status: "unauthorized", message: "Authentication validation dropped." });
    }

    const decryptedSecret = decryptSecret(company.telegramWebhookSecret);
    if (decryptedSecret !== signatureSecret) {
      console.error(`🚨 [Security Breach Alert] Unauthorized webhook payload injection attempted on Company ID: ${companyId} - Secret signature mismatch.`);
      return res.status(200).json({ status: "unauthorized", message: "Authentication validation dropped." });
    }



    const adapter = ProviderAdapterFactory.getAdapter("telegram");
    const standardizedFrame = adapter.normalizePayload(req.body);

    if (!standardizedFrame) {
      return res.status(200).json({ status: "ignored", message: "Empty or non-actionable transmission data." });
    }

    standardizedFrame.companyId = company.id;

    // Persist webhook payload in database asynchronously
    webhookPersistenceService.persist(
      "TELEGRAM",
      company.id,
      req.body?.update_id ? String(req.body.update_id) : null,
      req.body || {}
    ).catch((e) => console.warn("Failed to persist webhook metadata:", e));

    const boss = pgBossService.getBoss();
    await boss.send("webhook.process", standardizedFrame);

    return res.status(202).json({ status: "accepted" });

  } catch (error) {
    console.error(`[EdgeWebhookFailure] Failed to ingest message for tenant ${companyId}:`, error);
    return res.status(200).json({ status: "error", message: "Internal system boundary exception managed." });
  }
});

/**
 * ⚡ SECURE FALLBACK SCANNING ROUTE
 * Gracefully processes requests without route-parameter markers to avoid breaking active system tunnels.
 */
router.post("/webhook", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-api-secret-token"] as string;

  if (!secret) {
    return res.status(200).json({ status: "ignored", message: "Missing explicit perimeter routing assertions." });
  }

  try {
    const allCompaniesWithSecrets = await prisma.company.findMany({
      where: { telegramWebhookSecret: { not: null } },
      select: { id: true, telegramBotToken: true, telegramWebhookSecret: true }
    });

    const company = allCompaniesWithSecrets.find(c => decryptSecret(c.telegramWebhookSecret) === secret);

    if (!company) {
      console.error("🚨 [Security Breach Alert] Webhook received with unknown signature secret token.");
      return res.status(200).json({ status: "unauthorized", message: "Authentication validation dropped." });
    }

    const adapter = ProviderAdapterFactory.getAdapter("telegram");
    const standardizedFrame = adapter.normalizePayload(req.body);

    if (!standardizedFrame) {
      return res.status(200).json({ status: "ignored", message: "Empty or non-actionable transmission data." });
    }

    standardizedFrame.companyId = company.id;

    webhookPersistenceService.persist(
      "TELEGRAM",
      company.id,
      req.body?.update_id ? String(req.body.update_id) : null,
      req.body || {}
    ).catch((e) => console.warn("Failed to persist webhook metadata:", e));

    const boss = pgBossService.getBoss();
    await boss.send("webhook.process", standardizedFrame);

    return res.status(202).json({ status: "accepted" });
  } catch (error) {
    console.error("[LegacyWebhookFailure] Failed to scan secrets and ingest message:", error);
    return res.status(200).json({ status: "error", message: "Internal system boundary exception managed." });
  }
});

export default router;
