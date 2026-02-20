import { Router } from "express";
import { prisma } from "../lib/prisma";
import { processInstagramWebhook } from "../services/instagram.service"; // We will create this next/placeholder or keep simplistic
// For now, let's keep the logic inline or minimal as requested: "Instagram Webhook -> Normalize -> Save -> Trigger AI"

const router = Router();

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
        } else {
            res.sendStatus(403);
        }
    }
});

/**
 * POST /api/integrations/instagram/webhook
 * Event Handling
 */
router.post("/webhook", async (req, res) => {
    try {
        const body = req.body;

        if (body.object === "instagram") {
            // Process each entry
            for (const entry of body.entry) {
                // Entry contains messaging events
                if (entry.messaging) {
                    for (const webhookEvent of entry.messaging) {
                        // Determine Company based on page_id (entry.id or recipient.id)
                        // This requires a mapping of Instagram Page ID -> Company ID in our DB
                        // For now, logging the event structure as per requirement
                        console.log("Instagram Event:", JSON.stringify(webhookEvent));

                        // TODO: 
                        // 1. Normalize (extract sender_id, text)
                        // 2. Find Company by Page ID
                        // 3. Find/Create Lead by sender_id (IG PSID)
                        // 4. Save Message
                        // 5. Trigger AI Order Detection
                    }
                }
            }
            res.status(200).send("EVENT_RECEIVED");
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("Instagram Webhook Error:", error);
        res.sendStatus(500);
    }
});

export default router;
