import { Router, Request, Response } from "express";
import { pgBossService } from "../../services/infrastructure/pgboss/pgboss.service";
import { prisma } from "../../lib/prisma";
import { Channel } from "../../interfaces/messaging.interface";

const router = Router();

/**
 * Inbound Edge Middleware: Resolves tenant identity immediately 
 * at the outer perimeter using the Meta Page ID map.
 */
const resolveInstagramTenantIdentity = async (req: Request, res: Response, next: any) => {
  const pageId = req.body.entry?.[0]?.id;

  if (!pageId) {
    return res.status(200).json({ status: "ignored", message: "Malformed Meta payload frame." });
  }

  // Look up the unique tenant ownership context securely before hitting the queue
  const tenantMapping = await prisma.company.findFirst({
    where: { instagramPageId: String(pageId) },
    select: { id: true }
  });

  if (!tenantMapping) {
    console.error(`🚨 [Security Alert] Unauthorized or unmapped Instagram Page ID: ${pageId}`);
    return res.status(200).json({ status: "unmapped", message: "Tenant configuration missing." });
  }

  // Inject the validated company identifier cleanly into the request lifecycle
  req.headers["x-tenant-company-id"] = tenantMapping.id;
  next();
};

router.post("/webhook", resolveInstagramTenantIdentity, async (req: Request, res: Response) => {
  try {
    const entry = req.body.entry?.[0];
    const messaging = entry?.messaging?.[0];

    const standardizedFrame = {
      channel: Channel.INSTAGRAM,
      companyId: req.headers["x-tenant-company-id"] as string, // Guaranteed by edge middleware
      externalChatId: String(messaging?.sender?.id),
      text: messaging?.message?.text || "",
      isCallback: false
    };

    const boss = pgBossService.getBoss();
    await boss.send("webhook.process", standardizedFrame);
    return res.status(202).json({ status: "accepted" });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;

