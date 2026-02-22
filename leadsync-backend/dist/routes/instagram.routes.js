"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const instagram_adapter_1 = require("../adapters/instagram.adapter");
const router = (0, express_1.Router)();
/**
 * GET /api/integrations/instagram/webhook
 * Verification Challenge
 */
router.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token) {
        if (mode === "subscribe" && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        }
        else {
            res.sendStatus(403);
        }
    }
});
router.post("/webhook", async (req, res) => {
    try {
        const body = req.body;
        if (body.object === "instagram") {
            // Respond immediately to avoid retries
            res.status(200).send("EVENT_RECEIVED");
            // Process async
            (async () => {
                for (const entry of body.entry) {
                    const pageId = entry.id; // page_id
                    // Find Company by Instagram Page ID
                    const company = await prisma_1.prisma.company.findUnique({
                        where: { instagramPageId: pageId }
                    });
                    if (!company || !company.instagramPageAccessToken) {
                        console.warn(`⚠️ Received Instagram event for unknown page: ${pageId}`);
                        continue;
                    }
                    if (entry.messaging) {
                        const adapter = new instagram_adapter_1.InstagramAdapter(company.instagramPageAccessToken);
                        for (const webhookEvent of entry.messaging) {
                            // processWebhook handles lead creation, orders, AI, etc.
                            await adapter.processWebhook(webhookEvent, company.id);
                        }
                    }
                }
            })().catch(err => console.error("Instagram Async Error:", err));
        }
        else {
            res.sendStatus(404);
        }
    }
    catch (error) {
        console.error("Instagram Webhook Error:", error);
        if (!res.headersSent)
            res.sendStatus(500);
    }
});
exports.default = router;
