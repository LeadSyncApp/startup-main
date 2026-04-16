import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { newOrderArrivalService } from "../services/newOrderArrival.service";

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
      status: "NEW" // Only NEW orders in the intake queue
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

    // Enrich with customer history
    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      const customerHistory = await newOrderArrivalService.getCustomerHistory(
        order.companyId, 
        order.leadId
      );

      return {
        ...order,
        customerHistory,
        canCurrentUserClaim: true, // All eligible roles can claim
        isClaimed: false, // These are all unclaimed by definition
        timeInQueue: Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000), // minutes
      };
    }));

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

export default router;
