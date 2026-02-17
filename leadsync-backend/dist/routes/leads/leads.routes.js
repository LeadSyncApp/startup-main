"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * GET /api/leads
 * Company scoped via JWT
 */
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const companyId = req.user.companyId;
        const leads = await prisma_1.prisma.lead.findMany({
            where: {
                companyId,
            },
            include: {
                conversations: {
                    select: {
                        id: true,
                        messages: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: { content: true }
                        }
                    },
                    orderBy: { updatedAt: "desc" },
                    take: 1,
                },
            },
            orderBy: { createdAt: "desc" },
            take: 50, // Added limit
        });
        const formatted = leads.map((lead) => ({
            id: lead.id,
            name: lead.name || "Customer",
            contact: lead.contact,
            channel: lead.channel,
            createdAt: lead.createdAt,
            conversationId: lead.conversations[0]?.id || null,
            lastMessage: lead.conversations[0]?.messages[0]?.content || "",
            priority: "NORMAL",
            status: "NEW",
            agentAssigned: null,
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error("Fetch leads error:", error);
        res.status(500).json({ message: "Failed to fetch leads" });
    }
});
exports.default = router;
