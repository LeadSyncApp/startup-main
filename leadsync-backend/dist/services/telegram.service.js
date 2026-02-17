"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
async function createOrder(companyId, conversationId, leadId, summary) {
    return prisma_1.prisma.order.create({
        data: {
            companyId,
            conversationId,
            leadId,
            summary,
            priority: client_1.OrderPriority.NORMAL,
        },
    });
}
