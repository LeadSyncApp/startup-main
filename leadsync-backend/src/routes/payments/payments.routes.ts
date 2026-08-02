import { Router, Response } from "express";
import { authMiddleware, authorizeRoles, AuthRequest } from "../../middleware/auth.middleware";
import { Role } from "@prisma/client";
import { paymentEngineService } from "../../services/integrations/paymentEngine.service";
import { prisma } from "../../lib/prisma";

const router = Router();

/**
 * POST /api/payments/intents
 * Create a new PaymentIntent for a company/order
 */
router.post("/intents", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { companyId } = req.user!;
        const { amountInSubunits, amount, currency, orderId, metadata, idempotencyKey, contact } = req.body;

        const resolvedSubunits = amountInSubunits ? BigInt(amountInSubunits) : BigInt(Math.round((parseFloat(amount) || 0) * 100));

        if (resolvedSubunits <= 0n) {
            return res.status(400).json({ message: "Valid positive payment amount is required" });
        }

        const intent = await paymentEngineService.createPaymentIntent({
            companyId,
            amountInSubunits: resolvedSubunits,
            currency,
            orderId,
            metadata,
            idempotencyKey
        });

        let linkResult: any = null;
        if (contact) {
            linkResult = await paymentEngineService.createPaymentLinkForIntent(intent.id, contact);
        }

        res.json({
            message: "PaymentIntent created successfully",
            paymentIntent: {
                ...intent,
                amountInSubunits: intent.amountInSubunits.toString()
            },
            paymentLink: linkResult?.short_url || null
        });
    } catch (err: any) {
        console.error("❌ Create PaymentIntent error:", err);
        res.status(500).json({ message: err.message || "Failed to create PaymentIntent" });
    }
});

/**
 * GET /api/payments/intents/:id
 * Fetch details of a PaymentIntent including attempts and refunds
 */
router.get("/intents/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { companyId } = req.user!;
        const { id } = req.params;

        const intent = await prisma.paymentIntent.findFirst({
            where: { id, companyId },
            include: {
                attempts: true,
                refunds: true,
                order: true
            }
        });

        if (!intent) {
            return res.status(404).json({ message: "PaymentIntent not found" });
        }

        res.json({
            paymentIntent: {
                ...intent,
                amountInSubunits: intent.amountInSubunits.toString(),
                attempts: intent.attempts.map(a => ({ ...a, amountInSubunits: a.amountInSubunits.toString() })),
                refunds: intent.refunds.map(r => ({ ...r, amountInSubunits: r.amountInSubunits.toString() }))
            }
        });
    } catch (err: any) {
        console.error("❌ Get PaymentIntent error:", err);
        res.status(500).json({ message: err.message || "Failed to fetch PaymentIntent" });
    }
});

/**
 * POST /api/payments/:paymentIntentId/refund
 * Process a full or partial refund for a PaymentIntent
 * Restricted to OWNER and MANAGER roles
 */
router.post(
    "/:paymentIntentId/refund",
    authMiddleware,
    authorizeRoles(Role.OWNER, Role.MANAGER),
    async (req: AuthRequest, res: Response) => {
        try {
            const { companyId, userId } = req.user!;
            const { paymentIntentId } = req.params;
            const { amountInSubunits, amount, reason } = req.body;

            const resolvedAmount = amountInSubunits 
                ? BigInt(amountInSubunits) 
                : BigInt(Math.round((parseFloat(amount) || 0) * 100));

            if (resolvedAmount <= 0n) {
                return res.status(400).json({ message: "Valid positive refund amount is required" });
            }

            const result = await paymentEngineService.processRefund({
                companyId,
                paymentIntentId,
                amountInSubunits: resolvedAmount,
                reason,
                actor: { id: userId, name: (req.user as any).firstName || "Agent" }
            });

            res.json({
                message: "Refund processed successfully",
                refund: {
                    ...result.refund,
                    amountInSubunits: result.refund.amountInSubunits.toString()
                },
                paymentIntent: {
                    ...result.paymentIntent,
                    amountInSubunits: result.paymentIntent.amountInSubunits.toString()
                }
            });
        } catch (err: any) {
            console.error("❌ Refund processing error:", err);
            res.status(400).json({ message: err.message || "Failed to process refund" });
        }
    }
);

export default router;
