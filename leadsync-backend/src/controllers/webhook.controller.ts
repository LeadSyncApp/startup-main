import { Request, Response } from "express";
import { ProviderAdapterFactory } from "../adapters/provider.factory";
import { pgBossService } from "../services/infrastructure/pgboss/pgboss.service";

export async function handleWebhook(req: Request, res: Response): Promise<Response> {
  const { provider } = req.params;
  const payload = req.body;

  try {
    const adapter = ProviderAdapterFactory.getAdapter(provider);
    const standardizedFrame = adapter.normalizePayload(payload);

    if (!standardizedFrame || !standardizedFrame.externalChatId) {
      return res.status(200).json({ status: "ignored", message: "Empty or non-actionable transmission data." });
    }

    const companyId = (req.headers["x-tenant-company-id"] || req.query.companyId || req.headers["x-company-id"]) as string;
    
    if (!companyId) {
      console.warn(`🚨 [Routing Alert] Dropping inbound ${provider} payload: Missing 'x-tenant-company-id' resolution.`);
      return res.status(200).json({ status: "ignored", message: "Tenant resolution binding missing." });
    }

    standardizedFrame.companyId = companyId;

    // Enqueue the standardized frame directly into pg-boss
    const boss = pgBossService.getBoss();
    await boss.send("webhook.process", standardizedFrame);

    // ✅ No optimistic new_message emit here. The orchestrator worker
    // emits `new_message` to the per-conversation room once the message
    // is persisted, and `conversation_updated` for inbox deltas. The
    // agent UI joins the conversation room on select so it receives
    // both events reliably.

    // Instant 202 Accepted — releases the connection thread in <20ms
    return res.status(202).json({ status: "accepted" });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}
