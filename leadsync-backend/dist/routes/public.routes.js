"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
/**
 * POST /api/public/leads
 * Public endpoint – used by Home page
 */
router.post('/leads', async (req, res) => {
    try {
        const { name, contact } = req.body;
        if (!contact) {
            return res.status(400).json({ message: 'Contact is required' });
        }
        // ✅ OPTION B: single default company
        const company = await prisma_1.prisma.company.findFirst({
            orderBy: { createdAt: 'asc' },
        });
        if (!company) {
            return res.status(500).json({ message: 'No company configured' });
        }
        const lead = await prisma_1.prisma.lead.upsert({
            where: {
                contact_channel_companyId: {
                    contact,
                    channel: client_1.Channel.WEBSITE,
                    companyId: company.id,
                },
            },
            update: {},
            create: {
                name,
                contact,
                channel: client_1.Channel.WEBSITE,
                companyId: company.id,
                conversations: {
                    create: {
                        channel: client_1.Channel.WEBSITE,
                        companyId: company.id, // ✅ REQUIRED
                    },
                },
            },
            include: {
                conversations: true,
            },
        });
        res.json({ success: true, leadId: lead.id });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to create lead' });
    }
});
/**
 * GET /api/public/orders/:id
 * Public endpoint – Order Tracking
 */
router.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                summary: true,
                amount: true,
                createdAt: true,
                updatedAt: true,
                lead: {
                    select: {
                        name: true
                    }
                }
            }
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    }
    catch (err) {
        console.error("Tracking error:", err);
        res.status(500).json({ message: 'Failed to fetch order' });
    }
});
exports.default = router;
