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

const router = Router();

/* ===============================
   CREATE MANUAL ORDER
=============================== */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, summary, priority, amount } = req.body;

    if (!conversationId || !summary) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId: req.user.companyId,
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const order = await prisma.order.create({
      data: {
        companyId: req.user.companyId,
        conversationId: conversation.id,
        leadId: conversation.leadId,
        summary,
        priority: priority || OrderPriority.NORMAL,
        status: OrderStatus.NEW,
        amount: amount ?? 0,
        approvalStatus: OrderApprovalStatus.PENDING,
      },
    });

    return res.json(order);
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
});

/* ===============================
   GET ORDERS
=============================== */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const companyId = req.user.companyId;

    let whereCondition: any = { companyId };

    if (req.user.role === Role.AGENT) {
      whereCondition = {
        companyId,
        OR: [
          { approvalStatus: OrderApprovalStatus.PENDING },
          { processedById: req.user.userId },
        ],
      };
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        lead: true,
        conversation: true,
        processedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Added limit
    });

    return res.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/* ===============================
   APPROVE ORDER (RACE SAFE)
=============================== */
router.post("/:id/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const updated = await prisma.order.updateMany({
      where: {
        id,
        companyId: req.user.companyId,
        approvalStatus: OrderApprovalStatus.PENDING,
      },
      data: {
        approvalStatus: OrderApprovalStatus.APPROVED,
        status: OrderStatus.CONFIRMED,
        processedById: req.user.userId,
      },
    });

    if (updated.count === 0) {
      return res.status(400).json({ message: "Order already processed" });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { lead: true, company: true },
    });

    // Telegram send should NEVER break approval
    if (order?.company.telegramBotToken && order.lead?.contact) {
      try {
        await sendTelegramMessage(
          order.company.telegramBotToken,
          order.lead.contact,
          `✅ Your order has been approved!\n\n🛒 ${order.summary}\n\n💰 Total: ₹${order.amount}`
        );
      } catch (err) {
        console.error("Telegram send failed:", err);
      }
    }

    return res.json(order);
  } catch (error) {
    console.error("Approve order error:", error);
    return res.status(500).json({ message: "Failed to approve order" });
  }
});

/* ===============================
   REJECT ORDER (RACE SAFE)
=============================== */
router.post("/:id/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const updated = await prisma.order.updateMany({
      where: {
        id,
        companyId: req.user.companyId,
        approvalStatus: OrderApprovalStatus.PENDING,
      },
      data: {
        approvalStatus: OrderApprovalStatus.REJECTED,
        status: OrderStatus.CANCELLED,
        processedById: req.user.userId,
      },
    });

    if (updated.count === 0) {
      return res.status(400).json({ message: "Order already processed" });
    }

    return res.json({ message: "Order rejected" });
  } catch (error) {
    console.error("Reject order error:", error);
    return res.status(500).json({ message: "Failed to reject order" });
  }
});

/* ===============================
   UPDATE ORDER STATUS (SAFE)
=============================== */
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, amount } = req.body;
    const { id } = req.params;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const updated = await prisma.order.updateMany({
      where: {
        id,
        companyId: req.user.companyId,
      },
      data: {
        status,
        ...(status === OrderStatus.DELIVERED && {
          processedById: req.user.userId,
          amount: amount ?? undefined,
        }),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    return res.json(order);
  } catch (error) {
    console.error("Update order error:", error);
    return res.status(500).json({ message: "Failed to update order" });
  }
});

export default router;
