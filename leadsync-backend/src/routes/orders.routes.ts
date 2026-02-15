import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { OrderPriority, OrderStatus, Role } from "@prisma/client";

const router = Router();

/* ===============================
   CREATE ORDER
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

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.companyId !== req.user.companyId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const order = await prisma.order.create({
      data: {
        companyId: req.user.companyId,
        conversationId: conversation.id,
        leadId: conversation.leadId,
        summary,
        priority: priority || OrderPriority.NORMAL,
        status: OrderStatus.NEW,
        amount: amount || 0,
      },
    });

    return res.json(order);
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
});

/* ===============================
   GET ORDERS (ROLE AWARE)
=============================== */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let whereCondition: any = {
      companyId: req.user.companyId,
    };

    // AGENT sees only their processed orders
    if (req.user.role === "AGENT") {
      whereCondition.processedById = req.user.userId;
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/* ===============================
   UPDATE ORDER STATUS
=============================== */
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, amount } = req.body;
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.companyId !== req.user.companyId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updateData: any = {
      status,
    };

    // If order delivered → assign processor
    if (status === OrderStatus.DELIVERED) {
      updateData.processedById = req.user.userId;

      if (amount !== undefined) {
        updateData.amount = amount;
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        processedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Update order error:", error);
    return res.status(500).json({ message: "Failed to update order" });
  }
});

export default router;
