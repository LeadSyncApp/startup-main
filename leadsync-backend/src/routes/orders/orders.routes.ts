import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, authorizeRoles, AuthRequest } from "../../middleware/auth.middleware";
import {
  OrderPriority,
  OrderStatus,
  OrderApprovalStatus,
  Role,
  MessageSender,
} from "@prisma/client";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { safeEmitConversationUpdate, emitToCompany, emitToAgent } from "../../lib/socket";
import { recalculateLeadCRM } from "../../services/integrations/crm.service";

const router = Router();

/* ===============================
   CREATE ORDER
================================== */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, summary, priority, amount, isUrgent, customerName, phoneNumber, location, agentName, city, state } = req.body;

    let targetConversationId = conversationId;
    let targetSummary = summary;
    let targetLocation = location || "";
    if (city || state) {
      targetLocation = [city, state].filter(Boolean).join(", ");
    }

    const companyId = req.user!.companyId;

    if (!targetConversationId) {
      if (!phoneNumber || !customerName) {
        return res.status(400).json({ message: "Missing conversation ID, or customer details (name and phone) for manual order" });
      }

      // Find or create Lead
      let lead = await prisma.lead.findFirst({
        where: { contact: phoneNumber, companyId }
      });

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            name: customerName,
            contact: phoneNumber,
            channel: "WEBSITE",
            companyId,
            status: "CLAIMED"
          }
        });
      } else {
        // Update client name if specified
        lead = await prisma.lead.update({
          where: { id: lead.id },
          data: { name: customerName }
        });
      }

      // Find or create Conversation
      let conversation = await prisma.conversation.findFirst({
        where: { leadId: lead.id, companyId, channel: "WEBSITE" }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            leadId: lead.id,
            companyId,
            channel: "WEBSITE",
            mode: "HUMAN",
            status: "ASSIGNED",
            assignedToId: req.user!.userId,
            summary: "Manually created conversation for order taking"
          }
        });
      }

      targetConversationId = conversation.id;
    }

    if (!targetConversationId || !targetSummary) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: targetConversationId, companyId },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Location appending removed per user request for manual orders


    let initialScore = 0;
    if (priority === "URGENT" || isUrgent) initialScore += 50;
    if (amount && amount > 5000) initialScore += 30;

    // Force cast to allow new fields
    const order = await (prisma.order as any).create({
      data: {
        companyId,
        conversationId: conversation.id,
        leadId: conversation.leadId,
        summary: targetSummary,
        priority: priority || OrderPriority.NORMAL,
        status: OrderStatus.NEW,
        amount: amount ?? 0,
        approvalStatus: OrderApprovalStatus.PENDING,

        isUrgent: isUrgent || false,
        priorityScore: initialScore,
        predictedValue: amount,
        processedById: conversation.assignedToId || req.user!.userId,
        items: {
          location: targetLocation,
          baseSummary: summary,
          agentName: agentName || req.user!.name || "Agent",
          city: city || "",
          state: state || "",
          isManualLead: true,
        },
      },
      include: {
        lead: { select: { name: true, contact: true } }
      }
    });

    // 🆕 Update lead with pending order approval state
    await (prisma.lead as any).update({
      where: { id: conversation.leadId },
      data: {
        pendingOrderState: "CLAIMED_FOR_APPROVAL",
        pendingOrderId: order.id,
        pendingOrderSummary: summary,
        pendingOrderAmount: amount ?? 0,
        pendingOrderClaimedById: conversation.assignedToId || req.user!.userId,
        pendingOrderClaimedAt: new Date()
      }
    });

    // Dynamic CRM metrics recalculation
    await recalculateLeadCRM(conversation.leadId, companyId);

    safeEmitConversationUpdate(conversation, "order_created", order);
    
    // 🆕 Emit lead update for pending order
    emitToCompany(companyId, "lead_updated", {
      leadId: conversation.leadId,
      companyId,
      hasPendingOrderApproval: true,
      pendingOrderState: "PENDING_APPROVAL",
      pendingOrderId: order.id,
      pendingOrderSummary: summary,
      pendingOrderAmount: amount ?? 0,
      // 🆕 Include assignment info if conversation was already assigned
      ...(conversation.assignedToId ? {
        pendingOrderClaimedById: conversation.assignedToId,
        agentAssigned: "Agent" // Will be updated with actual agent name in frontend
      } : {})
    });

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
    
    console.log(`[DEBUG] Orders endpoint called with view: ${view}, query:`, req.query);

    let whereCondition: any = { companyId, isDeleted: false };

    if (view === "manual") {
      whereCondition.source = "MANUAL";
    } else if (view === "history") {
      // History: Completed, Delivered, Cancelled, Archived, Shipped
      whereCondition.status = { in: ["DELIVERED", "COMPLETED", "CANCELLED", "ARCHIVED", "REJECTED", "SHIPPED"] };
      if (req.user!.role === "AGENT") {
        whereCondition.processedById = req.user!.userId;
      }
    } else {
      // Active Board: Include all stages for agent view since they are scoped. Also support NEW/BOT_CREATED_ORDER for agents to see their own
      if (req.user!.role === "AGENT") {
        whereCondition.status = {
          in: ["NEW", "PENDING", "CONFIRMED", "PROCESSING", "PREPARING", "READY"]
        };
        whereCondition.processedById = req.user!.userId;
      } else {
        whereCondition.status = {
          in: ["PENDING", "CONFIRMED", "PROCESSING", "PREPARING", "READY"]
        };
      }
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
            orderCount: true,
            status: true,
            createdAt: true,
            lastActiveAt: true,
            pendingOrderState: true,
            pendingOrderId: true,
            pendingOrderSummary: true,
            pendingOrderAmount: true,
            conversations: {
              select: { id: true }
            }
          }
        },
        processedBy: {
          select: { id: true, name: true }
        },
        invoice: {
          select: { pdfUrl: true, invoiceNumber: true }
        }
      },
      orderBy: view === "history"
        ? [{ completedAt: "desc" }, { createdAt: "desc" }]
        : [{ priorityScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    console.log(`[DEBUG] Orders returned:`, orders.map((o: any) => ({ id: o.id, status: o.status, summary: o.summary })));
    return res.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

import { orderWorkflowService } from "../../services/workflow/orderWorkflow.service";

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

    // 🆕 Clear pending order state from lead when order is approved
    if (result.order) {
      // Lock conversation ownership to this agent
      await prisma.conversation.update({
        where: { id: result.order.conversationId },
        data: { assignedToId: req.user!.userId }
      });

      await (prisma.lead as any).update({
        where: { id: result.order.leadId },
        data: {
          pendingOrderState: "NONE",
          pendingOrderId: null,
          pendingOrderClaimedById: null,
          pendingOrderClaimedAt: null,
          pendingOrderSummary: null,
          pendingOrderAmount: null
        }
      });
      
      // 🆕 Emit lead update for all agents
      emitToCompany(req.user!.companyId, "lead_updated", {
        leadId: result.order.leadId,
        companyId: req.user!.companyId,
        hasPendingOrderApproval: false,
        pendingOrderState: "NONE"
      });
    }

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

    // 🆕 Clear pending order state from lead when order is rejected
    if (result.order) {
      await prisma.message.create({
        data: {
          content: "🚨 Order Rejected: Your order request has been rejected by the agent.",
          sender: MessageSender.SYSTEM,
          conversationId: result.order.conversationId
        }
      });

      await (prisma.lead as any).update({
        where: { id: result.order.leadId },
        data: {
          pendingOrderState: "NONE",
          pendingOrderId: null,
          pendingOrderClaimedById: null,
          pendingOrderClaimedAt: null,
          pendingOrderSummary: null,
          pendingOrderAmount: null
        }
      });
      
      // 🆕 Emit lead update for all agents
      emitToCompany(req.user!.companyId, "lead_updated", {
        leadId: result.order.leadId,
        companyId: req.user!.companyId,
        hasPendingOrderApproval: false,
        pendingOrderState: "NONE"
      });
    }

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
   CLAIM ORDER (Agent Assignment)
================================== */
router.post("/:id/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { version } = req.body;
    const { userId, companyId, role } = req.user!;

    // Only agents can claim orders
    if (!["AGENT", "ADMIN", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can claim orders" });
    }

    // Atomic claim: only if unclaimed
    const order = await prisma.order.findFirst({
      where: { 
        id, 
        companyId,
        processedById: null // Must be unclaimed
      }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found or already claimed" });
    }

    // Update with claim
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        processedById: userId,
        status: OrderStatus.PENDING, // Move to PENDING after claim
        updatedAt: new Date()
      },
      include: {
        lead: { select: { name: true, contact: true } },
        processedBy: { select: { id: true, name: true } },
        conversation: { select: { id: true } }
      }
    });

    // Emit socket events
    safeEmitConversationUpdate(updatedOrder.conversation, "order_updated", updatedOrder);
    emitToAgent(userId, "order_claimed", updatedOrder);

    return res.json(updatedOrder);
  } catch (error: any) {
    console.error("Claim order error:", error);
    return res.status(500).json({ message: "Failed to claim order" });
  }
});

/* ===============================
   GET AWAITING ORDERS (Agent-specific)
================================== */
router.get("/awaiting", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId, role } = req.user!;

    let whereCondition: any = { 
      companyId,
      isDeleted: false,
      status: { in: ["BOT_CREATED_ORDER", "PENDING", "NEW"] } // Awaiting orders
    };

    // Agents only see their own assigned/claimed orders
    if (role === "AGENT") {
      whereCondition.processedById = userId;
    }

    const orders = await prisma.order.findMany({
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
        conversation: {
          select: { id: true }
        }
      },
      orderBy: [
        { priorityScore: "desc" },
        { createdAt: "desc" }
      ],
      take: 50,
    });

    return res.json(orders);
  } catch (error) {
    console.error("Fetch awaiting orders error:", error);
    return res.status(500).json({ message: "Failed to fetch awaiting orders" });
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
