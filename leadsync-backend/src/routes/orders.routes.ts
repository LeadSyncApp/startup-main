import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import {
  OrderPriority,
  OrderStatus,
  OrderApprovalStatus,
  Role,
} from "@prisma/client";
import { sendTelegramMessage } from "../bot/telegram.sender";
import { emitToCompany } from "../lib/socket";

const router = Router();

/* ===============================
   CREATE ORDER
================================== */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, summary, priority, amount, isUrgent } = req.body;

    if (!conversationId || !summary) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const companyId = req.user!.companyId;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    let initialScore = 0;
    if (priority === "URGENT" || isUrgent) initialScore += 50;
    if (amount && amount > 5000) initialScore += 30;

    // Force cast to allow new fields
    const order = await (prisma.order as any).create({
      data: {
        companyId,
        conversationId: conversation.id,
        leadId: conversation.leadId,
        summary,
        priority: priority || OrderPriority.NORMAL,
        status: OrderStatus.NEW,
        amount: amount ?? 0,
        approvalStatus: OrderApprovalStatus.PENDING,

        isUrgent: isUrgent || false,
        priorityScore: initialScore,
        predictedValue: amount,
      },
      include: {
        lead: { select: { name: true, contact: true } }
      }
    });

    emitToCompany(companyId, "order_created", order);

    return res.json(order);
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
});

/* ===============================
   GET ORDERS
================================== */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const filterUserId = req.user!.role === Role.AGENT ? req.user!.userId : undefined;

    // Standard visibility: Everyone sees all relevant orders for now to enable "Shared Ops"
    let whereCondition: any = { companyId };

    const orders = await (prisma.order as any).findMany({
      where: whereCondition,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            contact: true,
            channel: true,
            totalSpend: true,
            segment: true,
          }
        },
        processedBy: {
          select: { id: true, name: true }
        },
      },
      orderBy: [
        { priorityScore: "desc" },
        { createdAt: "desc" }
      ],
      take: 100,
    });

    return res.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/* ===============================
   APPROVE ORDER
================================== */
router.post("/:id/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const existing = await prisma.order.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: "Order not found" });

    // Force cast update
    const updatedRaw = await (prisma.order as any).update({
      where: { id },
      data: {
        approvalStatus: OrderApprovalStatus.APPROVED,
        status: OrderStatus.CONFIRMED,
        processedById: req.user!.userId,
        priorityScore: { increment: 10 },
      },
      include: { lead: true, company: true }
    });

    const updated = updatedRaw as any;

    if (updated.company?.telegramBotToken && updated.lead?.contact) {
      sendTelegramMessage(
        updated.company.telegramBotToken,
        updated.lead.contact,
        `✅ Your order has been confirmed!\n\n🛒 ${updated.summary}\n💰 Amount: ₹${updated.amount}`
      ).catch(console.error);
    }

    emitToCompany(companyId, "order_updated", updated);

    return res.json(updated);
  } catch (error) {
    console.error("Approve error:", error);
    return res.status(500).json({ message: "Failed to approve order" });
  }
});

/* ===============================
   REJECT ORDER
================================== */
router.post("/:id/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const existing = await prisma.order.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: "Order not found" });

    const updated = await (prisma.order as any).update({
      where: { id },
      data: {
        approvalStatus: OrderApprovalStatus.REJECTED,
        status: OrderStatus.CANCELLED,
        processedById: req.user!.userId,
        priorityScore: 0,
      }
    });

    emitToCompany(companyId, "order_updated", updated);

    return res.json(updated);
  } catch (error) {
    console.error("Reject error:", error);
    return res.status(500).json({ message: "Failed to reject order" });
  }
});

/* ===============================
   UPDATE STATUS / PRIORITY
================================== */
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, priorityScore, isUrgent } = req.body;
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const existing = await prisma.order.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: "Order not found" });

    const updateData: any = { status };
    if (priorityScore !== undefined) updateData.priorityScore = priorityScore;
    if (isUrgent !== undefined) updateData.isUrgent = isUrgent;

    if (status === "DELIVERED" || status === "READY") {
      if (!existing.processedById) updateData.processedById = req.user!.userId;
    }

    const updated = await (prisma.order as any).update({
      where: { id },
      data: updateData
    });

    emitToCompany(companyId, "order_updated", updated);

    return res.json(updated);
  } catch (error) {
    console.error("Update status error:", error);
    return res.status(500).json({ message: "Failed to update order" });
  }
});

export default router;
