import { Router } from "express";
import { handleWebhook } from "../../controllers/webhook.controller";

const router = Router();

// Unified endpoint for customer chat webhooks
// example: POST /api/webhook/chat/telegram
// example: POST /api/webhook/chat/whatsapp
router.post("/:provider", handleWebhook);

export default router;
