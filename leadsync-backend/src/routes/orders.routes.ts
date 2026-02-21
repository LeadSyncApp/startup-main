import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, authorizeRoles, AuthRequest } from "../middleware/auth.middleware";
import {
  OrderPriority,
  OrderStatus,
  OrderApprovalStatus,
  Role,
  MessageSender,
} from "@prisma/client";
import { sendTelegramMessage } from "../bot/telegram.sender";
import { safeEmitConversationUpdate } from "../lib/socket";

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

    safeEmitConversationUpdate(conversation, "order_created", order);

    return res.json(order);
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
});

/* ===============================
   GET ORDERS (Filtered)
================================== */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const view = req.query.view as string; // 'active' | 'history'

    let whereCondition: any = { companyId, isDeleted: false };

    if (view === "history") {
      // History: Completed, Delivered, Cancelled, Archived, Shipped
      whereCondition.status = { in: ["DELIVERED", "COMPLETED", "CANCELLED", "ARCHIVED", "REJECTED", "SHIPPED"] };
    } else {
      // Active Board: Include all non-terminal stages
      whereCondition.status = {
        in: ["NEW", "PENDING", "BOT_CREATED_ORDER", "CONFIRMED", "PROCESSING", "PREPARING", "READY"]
      };
    }

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
            // ...
          }
        },
        processedBy: {
          select: { id: true, name: true }
        },
      },
      orderBy: view === "history"
        ? [{ completedAt: "desc" }, { createdAt: "desc" }]
        : [{ priorityScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return res.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

import { orderWorkflowService } from "../services/orderWorkflow.service";

/* ===============================
   APPROVE ORDER (Activates Pending)
================================== */
router.post("/:id/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { version } = req.body; // Optimistic Lock
    const companyId = req.user!.companyId;

    const result = await orderWorkflowService.transitionStatus(
      id,
      OrderStatus.PROCESSING, // 🆕 Move to PROCESSING (Active)
      {
        id: req.user!.userId,
        name: "Agent",
        role: req.user!.role
      },
      version
    );

    return res.json(result.order);
  } catch (error: any) {
    if (error.message?.includes("CONCURRENCY")) {
      return res.status(409).json({ message: error.message });
    }
    console.error("Approve error:", error);
    return res.status(500).json({ message: error.message || "Failed to approve order" });
  }
});

/* ===============================
   REJECT ORDER (Archives)
================================== */
router.post("/:id/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { version } = req.body;

    const result = await orderWorkflowService.transitionStatus(
      id,
      OrderStatus.REJECTED,
      {
        id: req.user!.userId,
        name: "Agent",
        role: req.user!.role
      },
      version
    );

    return res.json(result.order);
  } catch (error: any) {
    if (error.message?.includes("CONCURRENCY")) {
      return res.status(409).json({ message: error.message });
    }
    console.error("Reject error:", error);
    return res.status(500).json({ message: error.message || "Failed to reject order" });
  }
});

/* ===============================
   UPDATE STATUS (Lifecycle)
================================== */
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, version } = req.body; // Now expects status AND version
    const { id } = req.params;

    const result = await orderWorkflowService.transitionStatus(
      id,
      status as OrderStatus,
      {
        id: req.user!.userId,
        name: "Agent",
        role: req.user!.role
      },
      version
    );

    return res.json(result.order);
  } catch (error: any) {
    if (error.message?.includes("Invalid transition")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message?.includes("CONCURRENCY")) {
      return res.status(409).json({ message: error.message });
    }
    console.error("Update status error:", error);
    return res.status(500).json({ message: "Failed to update order" });
  }
});

/* ===============================
   SOFT DELETE ORDER (History Archive)
   🔒 Restricted to: OWNER, ADMIN
================================== */
router.delete("/:id", authMiddleware, authorizeRoles("OWNER", "ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    // Soft delete
    const updated = await prisma.order.updateMany({
      where: { id, companyId },
      data: { isDeleted: true } as any
    });

    if (updated.count === 0) return res.status(404).json({ message: "Order not found" });

    return res.json({ message: "Order archived" });
  } catch (error) {
    console.error("Delete order error:", error);
    return res.status(500).json({ message: "Failed to delete order" });
  }
});

export default router;
