import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { newOrderArrivalService } from "../services/workflow/newOrderArrival.service";
import { emitToCompany } from "../lib/socket";

const router = Router();

/* ===============================
   GET NEW ORDER ARRIVALS
   Fetch all unclaimed orders in the intake queue
================================== */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId, role } = req.user!;

    // Build where condition based on role
    let whereCondition: any = { 
      companyId,
      isDeleted: false,
      status: "NEW", // Only NEW orders in the intake queue
      processedById: null // Only show unclaimed orders in the universal queue
    };

    // All roles can see unclaimed orders for claiming
    // No additional filtering needed - this is the universal intake queue

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
            orderCount: true,
            segment: true,
            status: true
          }
        },
        conversation: {
          select: { 
            id: true,
            mode: true,
            assignedToId: true,
            assignedTo: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: [
        { priorityScore: "desc" }, // High priority first
        { createdAt: "desc" } // Then by recency
      ],
      take: 100,
    });

    // Enrich with customer history using optimized batch fetcher
    const leadIds = orders.map(o => o.leadId);
    const historiesMap = await newOrderArrivalService.getCustomerHistoryBatch(companyId, leadIds);

    const enrichedOrders = orders.map((order) => {
      const customerHistory = historiesMap[order.leadId] || {
        isExistingCustomer: false,
        previousOrderCount: 0,
        previousSpend: 0,
        recentOrders: [],
        wasDeleted: false,
        wasClosed: false
      };

      return {
        ...order,
        customerHistory,
        canCurrentUserClaim: true, // All eligible roles can claim
        isClaimed: false, // These are all unclaimed by definition
        timeInQueue: Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000), // minutes
      };
    });

    res.json(enrichedOrders);
  } catch (error) {
    console.error("Fetch new order arrivals error:", error);
    res.status(500).json({ message: "Failed to fetch new order arrivals" });
  }
});

/* ===============================
   CLAIM NEW ORDER ARRIVAL
   Claim an order from the intake queue
================================== */
router.post("/:id/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, companyId, role } = req.user!;

    // Only agents, admins, and owners can claim orders
    if (!["AGENT", "ADMIN", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can claim orders" });
    }

    const result = await newOrderArrivalService.claimOrderArrival(
      id,
      userId,
      req.user?.name || "Agent", // Use name from auth middleware
      role
    );

    res.json(result);
  } catch (error: any) {
    console.error("Claim order arrival error:", error);
    if (error.message?.includes("not found") || error.message?.includes("already claimed")) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to claim order" });
  }
});

/* ===============================
   GET CLAIMED ORDERS
   Get orders that have been claimed and are being processed
================================== */
router.get("/claimed", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId, role } = req.user!;

    let whereCondition: any = { 
      companyId,
      isDeleted: false,
      status: { in: ["PROCESSING", "PREPARING", "READY", "SHIPPED"] } // Active processing states
    };

    // Role-based filtering for claimed orders
    if (role === "AGENT") {
      whereCondition.OR = [
        { processedById: userId }, // My claimed orders
      ];
    }
    // Admins and owners see all claimed orders

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
            orderCount: true,
            segment: true
          }
        },
        processedBy: {
          select: { id: true, name: true }
        },
        conversation: {
          select: { 
            id: true,
            mode: true,
            assignedToId: true
          }
        }
      },
      orderBy: [
        { priorityScore: "desc" },
        { updatedAt: "desc" }
      ],
      take: 50,
    });

    res.json(orders);
  } catch (error) {
    console.error("Fetch claimed orders error:", error);
    res.status(500).json({ message: "Failed to fetch claimed orders" });
  }
});

/* ===============================
   GET CUSTOMER HISTORY
   Get detailed history for a customer
================================== */
router.get("/customer/:leadId/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { leadId } = req.params;

    const customerHistory = await newOrderArrivalService.getCustomerHistory(companyId, leadId);

    res.json(customerHistory);
  } catch (error) {
    console.error("Get customer history error:", error);
    res.status(500).json({ message: "Failed to fetch customer history" });
  }
});

/* ===============================
   AGENT MANUAL ORDER CONFIRMATION
================================== */
router.post("/confirm-order/:orderId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const agentId = req.user!.userId;
    const agentName = req.user!.name;
    const agentRole = req.user!.role;

    // Verify the order exists and is in NEW status
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: "NEW",
        OR: [
          { processedById: agentId },
          { processedById: null }
        ]
      },
      include: {
        conversation: { include: { lead: true } },
        lead: true
      }
    });

    if (!order) {
      return res.status(404).json({ 
        message: "Order not found or not eligible for confirmation" 
      });
    }

    // Update order to PENDING status - this moves it to Orders page
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PENDING", // Move to Orders page
        processedById: order.processedById || agentId,
        updatedAt: new Date()
      },
      include: {
        conversation: { include: { lead: true } },
        processedBy: { select: { id: true, name: true } },
        lead: true
      }
    });

    // Update lead state
    await prisma.lead.update({
      where: { id: order.leadId },
      data: {
        pendingOrderState: "CLAIMED_FOR_APPROVAL",
        pendingOrderClaimedById: order.processedById || agentId,
        pendingOrderClaimedAt: new Date(),
        lastActiveAt: new Date()
      }
    });

    // Emit events
    emitToCompany(order.companyId, "order_manually_confirmed", {
      orderId: order.id,
      conversationId: order.conversationId,
      leadId: order.leadId,
      confirmedBy: { id: agentId, name: agentName },
      order: updatedOrder
    });

    // Remove from New Order Arrivals queue
    emitToCompany(order.companyId, "order_arrival_confirmed", {
      orderId: order.id,
      conversationId: order.conversationId,
      confirmedBy: { id: agentId, name: agentName }
    });

    console.log(`\u2705 [NewOrderArrival] Order ${orderId} manually confirmed by ${agentName}`);

    res.json({
      message: "Order confirmed and moved to Orders page",
      order: updatedOrder
    });

  } catch (error) {
    console.error("Manual order confirmation error:", error);
    res.status(500).json({ message: "Failed to confirm order" });
  }
});

export default router;
