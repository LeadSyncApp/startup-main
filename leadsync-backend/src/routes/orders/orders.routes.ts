import { Router, Response } from "express";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createTenantRepository } from "../../lib/tenantDb";
import { authMiddleware, authorizeRoles, AuthRequest } from "../../middleware/auth.middleware";
import { eventBus, Events } from "../../services/infrastructure/eventBus";
import {
  OrderPriority,
  OrderStatus,
  OrderApprovalStatus,
  Role,
} from "@prisma/client";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { safeEmitConversationUpdate, emitToCompany, emitToAgent } from "../../lib/socket";
import { recalculateLeadCRM } from "../../services/integrations/crm.service";
import { decrementStockForOrder } from "../../services/knowledge/inventory.service";

const router = Router();

/* ===============================
   CREATE PAYMENT REQUEST (PRODUCT CATALOG BASED)
================================== */
router.post("/payment-request", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, products, note, customAmount } = req.body;
    const { companyId } = req.user!;

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required" });
    }
    
    const hasProducts = products && Array.isArray(products) && products.length > 0;
    
    if (!hasProducts && !customAmount) {
      return res.status(400).json({ message: "Either a list of products or a custom amount is required" });
    }

    // 1. Fetch real product data to prevent price tampering (if products exist)
    let totalAmount = 0;
    let orderItemsData: any[] = [];
    
    if (hasProducts) {
      const productIds = products.map((p: any) => p.productId);
      const dbProducts = await (prisma.inventoryProduct as any).findMany({
        where: { 
          id: { in: productIds },
          companyId 
        },
        include: {
          variants: true
        }
      });

      if (dbProducts.length === 0) {
        return res.status(400).json({ message: "No valid products found in catalog" });
      }

      orderItemsData = products.map((p: any) => {
        const dbProduct = dbProducts.find((dp: any) => dp.id === p.productId);
        if (!dbProduct) return null;

        const qty = parseInt(p.quantity) || 1;
        let price = dbProduct.basePrice;
        let variantAttr: string | null = null;
        
        if (p.variantId) {
          const variant = dbProduct.variants.find((v: any) => v.id === p.variantId);
          if (variant) {
            if (variant.price !== null) price = variant.price;
            variantAttr = variant.attributeValue;
          }
        }
        
        totalAmount += price * qty;

        return {
          companyId,
          productId: null,
          sku: p.variantId || null,
          name: variantAttr ? `${dbProduct.name} - ${variantAttr}` : dbProduct.name,
          quantity: qty,
          price: price,
          cogs: 0
        };
      }).filter(Boolean);
    } else if (customAmount) {
      totalAmount = parseFloat(customAmount);
      orderItemsData = [{
        companyId,
        name: "Custom Payment",
        quantity: 1,
        price: totalAmount,
        cogs: 0
      }];
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ message: "Company not found" });

    let lead = await prisma.lead.findFirst({
      where: { companyId, contact: "9999999999" }
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          companyId,
          name: "Simulator Customer",
          contact: "9999999999",
          channel: "WEBSITE",
        }
      });
    }

    const upiId = "business@bank";
    const upiName = "business@bank";
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { company: { select: { name: true } } } });
    const cleanNote = note || `Payment for order from ${conv?.company?.name || "store"}`;
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

    // 3. Create the Order and its items
    const order = await prisma.order.create({
      data: {
        companyId,
        conversationId,
        leadId: lead!.id,
        amount: totalAmount,
        status: OrderStatus.PENDING,
        summary: note || `Order for ${orderItemsData.length} item(s)`,
        source: "MANUAL",
        metadata: {
          upiLink,
          isPaymentRequest: true,
          catalogBased: hasProducts
        },
        orderItems: {
          create: orderItemsData as any
        }
      },
      include: {
        orderItems: true
      }
    });

    // Decrement stock for catalog-based orders with real products
    if (hasProducts) {
      decrementStockForOrder(order.id, companyId).catch(err =>
        console.error(`❌ [StockDecrement] Failed for order ${order.id}:`, err)
      );
    }

    res.json({
      message: "Catalog-based payment request generated",
      order,
      upiLink
    });

  } catch (error) {
    console.error("Payment request error:", error);
    res.status(500).json({ message: "Failed to generate payment request" });
  }
});

/* ===============================
   SIMULATE PAYMENT SUCCESS (WEBHOOK MOCK)
================================== */
router.post("/:id/simulate-success", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { companyId } = req.user!;

    // 1. Find the order with items
    const order = await prisma.order.findUnique({
      where: { id, companyId },
      include: { orderItems: true }
    });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === OrderStatus.PAID) return res.status(400).json({ message: "Order is already paid" });

    // Find conversation via lead
    const conv = order.leadId ? await prisma.conversation.findFirst({
      where: { leadId: order.leadId, lifecycleStatus: 'active' }
    }) : null;

    // 2. Perform automated updates in a transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id },
        data: { 
          status: OrderStatus.PAID,
          completedAt: new Date()
        }
      });

      // Automated Inventory Management: Decrement stock for tracked products
      for (const item of order.orderItems) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity
              }
            }
          });
        }
      }

      return updated;
    });

    // Notify event bus for analytics/reporting
    eventBus.emit(Events.ORDER_UPDATED, { order: updatedOrder });
    
    // Notify frontend via Socket - use the found conversation
    if (conv) {
      safeEmitConversationUpdate(conv as any, "payment_confirmed", updatedOrder);
    }

    res.json({ 
      message: "Payment successfully simulated! Stock has been auto-deducted.", 
      order: updatedOrder 
    });
  } catch (error) {
    console.error("Simulate success error:", error);
    res.status(500).json({ message: "Failed to simulate payment success" });
  }
});

/* ===============================
   MARK ORDER AS PAID
================================== */
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { companyId } = req.user!;

    const order = await prisma.order.findUnique({
      where: { id, companyId }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        status: status as OrderStatus,
        completedAt: status === OrderStatus.PAID ? new Date() : order.completedAt
      }
    });

    // Notify event bus (e.g. for analytics)
    eventBus.emit(Events.ORDER_UPDATED, { order: updatedOrder });

    res.json({ message: `Order status updated to ${status}`, order: updatedOrder });
  } catch (error) {
    console.error("Order status update error:", error);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

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

      const safeLead = lead!;

      // Find or create Conversation
      let conversation = await prisma.conversation.findFirst({
        where: { leadId: safeLead.id, companyId, channel: "WEBSITE" }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            leadId: safeLead.id,
            companyId,
            channel: "WEBSITE",
            status: ConversationStatus.OPEN,
            claimedById: req.user!.userId,
          }
        });
      }

      targetConversationId = conversation!.id;
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
        leadId: conversation.leadId,
        summary: targetSummary,
        priority: priority || OrderPriority.NORMAL,
        status: OrderStatus.NEW,
        amount: amount ?? 0,
        approvalStatus: OrderApprovalStatus.PENDING,

        isUrgent: isUrgent || false,
        priorityScore: initialScore,
        predictedValue: amount,
        processedById: (conversation as any).claimedById || req.user!.userId,
        items: {
          location: targetLocation,
          baseSummary: summary,
          agentName: agentName || (req.user as any)?.firstName || "Agent",
          city: city || "",
          state: state || "",
          isManualLead: true,
        },
      },
      include: {
        lead: { select: { name: true, contact: true } }
      }
    });

    // 🆕 Create relational Order Items (Link to the Master Catalog)
    const items = req.body.items;
    if (items && Array.isArray(items)) {
      const itemRecords = items.map((item: any) => ({
        orderId: order.id,
        productId: item.productId || null,
        sku: item.sku || null,
        name: item.name,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
      }));

      await prisma.orderItem.createMany({
        data: itemRecords
      });
    }

    // 🆕 Update lead with pending order approval state (pendingOrder fields removed from schema)
    // Removed pendingOrder state updates as they no longer exist in schema

    // Dynamic CRM metrics recalculation
    if (conversation.leadId) {
      await recalculateLeadCRM(conversation.leadId, companyId);
    }

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
      ...((conversation as any).claimedById ? {
        pendingOrderClaimedById: (conversation as any).claimedById,
        agentAssigned: "Agent"
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
    const tenantDb = createTenantRepository(req.user!.companyId);
    const view = req.query.view as string; // 'active' | 'history'
    
    console.log(`[DEBUG] Orders endpoint called with view: ${view}, query:`, req.query);

    let whereCondition: any = { isDeleted: false };

    if (view === "manual") {
      whereCondition.source = "MANUAL";
    } else if (view === "history") {
      // History: Completed, Delivered, Cancelled, Archived, Shipped mapped to valid Enums
      whereCondition.status = { in: ["DELIVERED", "PAID", "CANCELLED"] };
      if (req.user!.role === "STAFF") {
        whereCondition.processedById = req.user!.userId;
      }
    } else {
      // Active Board: Include all stages for agent view since they are scoped. Also support NEW/BOT_CREATED_ORDER for agents to see their own
      if (req.user!.role === "STAFF") {
        whereCondition.status = {
          in: ["NEW", "PENDING", "CONFIRMED", "PROCESSING", "PREPARING", "READY", "PAID", "SHIPPED"]
        };
        whereCondition.processedById = req.user!.userId;
      } else {
        whereCondition.status = {
          in: ["PENDING", "CONFIRMED", "PROCESSING", "PREPARING", "READY", "PAID", "SHIPPED"]
        };
      }
    }

    const orders = await tenantDb.order.findMany({
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
          conversations: {
            select: { id: true }
          }
          }
        },
        processedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        orderItems: true,
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
      companyId,
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
      // Lock conversation ownership to this agent - use claimedById instead of assignedToId
      await prisma.conversation.update({
        where: { id: (result.order as any).conversationId },
        data: { claimedById: req.user!.userId }
      });

      // 🚀 FIRE IMMUTABLE EVENT TO MICROSERVICES (Deducts stock and creates bill)
      eventBus.emit(Events.ORDER_CREATED, result.order.id, companyId);
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
      req.user!.companyId,
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
      req.user!.companyId,
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
    if (!["STAFF", "MANAGER", "OWNER"].includes(role)) {
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
        processedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Emit socket events - find conversation via lead for the emit
    const conv = order.leadId ? await prisma.conversation.findFirst({
      where: { leadId: order.leadId, lifecycleStatus: 'active' }
    }) : null;
    if (conv) {
      safeEmitConversationUpdate(conv, "order_updated", updatedOrder);
    }
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
    if (role === "STAFF") {
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
          select: { id: true, firstName: true, lastName: true }
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
router.delete("/:id", authMiddleware, authorizeRoles("OWNER", "MANAGER"), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    // Soft delete
    const updated = await prisma.order.updateMany({
      where: { id, companyId },
      data: { isDeleted: true }
    });

    if (updated.count === 0) return res.status(404).json({ message: "Order not found" });

    return res.json({ message: "Order archived" });
  } catch (error) {
    console.error("Delete order error:", error);
    return res.status(500).json({ message: "Failed to delete order" });
  }
});

export default router;