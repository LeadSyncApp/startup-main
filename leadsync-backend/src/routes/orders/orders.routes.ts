import { Router, Response } from "express";
import { ConversationStatus, MessageSender } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createTenantRepository } from "../../lib/tenantDb";
import { authMiddleware, authorizeRoles, authorizePermission, AuthRequest } from "../../middleware/auth.middleware";
import { can } from "../../services/auth/permissions.service";
import { eventBus, Events } from "../../services/infrastructure/eventBus";
import {
  OrderPriority,
  OrderStatus,
  OrderApprovalStatus,
  Role,
} from "@prisma/client";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { safeEmitConversationUpdate, emitToCompany, emitToAgent, emitToConversation } from "../../lib/socket";
import { recalculateLeadCRM } from "../../services/integrations/crm.service";
import { decrementStockForOrder } from "../../services/knowledge/inventory.service";
import { orderWorkflowService } from "../../services/workflow/orderWorkflow.service";
import { queueProvider } from "../../services/infrastructure/queue-provider/queue-provider.factory";
import { PDF_JOB_NAME } from "../../services/infrastructure/pgboss/jobs/pdf.job";
import { businessNotificationService } from "../../services/infrastructure/businessNotification.service";
import { cacheService } from "../../services/infrastructure/cache.service";

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
        let price = Number(dbProduct.price ?? dbProduct.basePrice ?? 0);
        if (!price && dbProduct.basePriceInSubunits) {
          price = Number(dbProduct.basePriceInSubunits) > 10000 
            ? Number(dbProduct.basePriceInSubunits) / 100 
            : Number(dbProduct.basePriceInSubunits);
        }
        let variantAttr: string | null = null;
        
        if (p.variantId && dbProduct.variants) {
          const variant = dbProduct.variants.find((v: any) => v.id === p.variantId);
          if (variant) {
            if (variant.price !== null && variant.price !== undefined) {
              price = Number(variant.price);
            } else if (variant.priceInSubunits !== null && variant.priceInSubunits !== undefined) {
              const vPrice = Number(variant.priceInSubunits);
              price = vPrice > 10000 ? vPrice / 100 : vPrice;
            }
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
          priceInSubunits: BigInt(Math.round((price || 0) * 100)),
          cogs: 0,
          cogsInSubunits: 0n
        };
      }).filter(Boolean);
    } else if (customAmount) {
      totalAmount = parseFloat(customAmount);
      orderItemsData = [{
        companyId,
        name: "Custom Payment",
        quantity: 1,
        price: totalAmount,
        priceInSubunits: BigInt(Math.round(totalAmount * 100)),
        cogs: 0,
        cogsInSubunits: 0n
      }];
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Find conversation and its associated lead
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      include: { lead: true, company: { select: { name: true } } }
    });

    if (!conv) {
      return res.status(400).json({ message: "Conversation not found" });
    }

    let leadId = conv.leadId;

    // If conversation has no lead yet, create or find one for this conversation
    if (!leadId) {
      let lead = await prisma.lead.findFirst({
        where: { companyId, contact: `conv_${conversationId.slice(0, 8)}`, deletedAt: null }
      });
      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            companyId,
            name: "Customer",
            contact: `conv_${conversationId.slice(0, 8)}`,
            channel: conv.channel || "WEBSITE",
          }
        });
      }
      leadId = lead!.id;
    }

    const upiId = "business@bank";
    const upiName = "business@bank";
    const cleanNote = note || `Payment for order from ${conv?.company?.name || "store"}`;
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

    // Create or update PENDING order for this conversation so it immediately appears in Wait for Payment
    let pendingOrder: any = await prisma.order.findFirst({
      where: { conversationId, companyId, status: OrderStatus.PENDING },
      include: { orderItems: true }
    });

    if (!pendingOrder) {
      pendingOrder = await prisma.order.create({
        data: {
          companyId,
          conversationId,
          leadId: leadId!,
          amount: totalAmount,
          amountInSubunits: BigInt(Math.round(totalAmount * 100)),
          status: OrderStatus.PENDING,
          summary: note || `Payment Request for ${orderItemsData.length} item(s)`,
          source: "MANUAL",
          processedById: req.user!.userId,
          metadata: {
            upiLink,
            isPaymentRequest: true,
            catalogBased: hasProducts
          },
          orderItems: {
            create: orderItemsData.map((item: any) => ({
              companyId,
              sku: item.sku || null,
              name: item.name,
              quantity: item.quantity || 1,
              price: item.price || 0,
              priceInSubunits: BigInt(Math.round((item.price || 0) * 100)),
              cogs: 0,
              cogsInSubunits: 0n
            }))
          }
        },
        include: { orderItems: true }
      });
      emitToCompany(companyId, "order_created", pendingOrder);
    } else {
      pendingOrder = await prisma.order.update({
        where: { id: pendingOrder.id },
        data: {
          amount: totalAmount,
          amountInSubunits: BigInt(Math.round(totalAmount * 100)),
          summary: note || pendingOrder.summary,
        },
        include: { orderItems: true }
      });
      emitToCompany(companyId, "order_updated", pendingOrder);
    }

    emitToCompany(companyId, "dashboard_metrics_updated", { refreshNeeded: true });

    const paymentPayload = {
      conversationId,
      leadId: leadId!,
      companyId,
      amount: totalAmount,
      amountInSubunits: Math.round(totalAmount * 100),
      summary: note || `Order for ${orderItemsData.length} item(s)`,
      orderItems: orderItemsData,
      catalogBased: hasProducts,
      upiLink,
      orderId: pendingOrder.id
    };

    res.json({
      message: "Payment request generated",
      paymentPayload,
      upiLink,
      order: pendingOrder
    });

  } catch (error) {
    console.error("Payment request error:", error);
    res.status(500).json({ message: "Failed to generate payment request" });
  }
});

/* ===============================
   FULFILL PAYMENT REQUEST (DEFERRED ORDER CREATION ON PAYMENT CONFIRMATION)
================================== */
router.post("/fulfill-payment-request", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentPayload } = req.body;
    const { companyId, userId, role } = req.user!;
    const userDisplayName = (req.user as any).firstName || (req.user as any).name || "Agent";

    if (!paymentPayload || !paymentPayload.conversationId || !paymentPayload.amount) {
      return res.status(400).json({ message: "Invalid payment payload" });
    }

    // Sanitize item.productId: only pass productId if it exists in the Product table (prevents FK constraint errors for InventoryProduct IDs)
    const incomingProductIds = (paymentPayload.orderItems || [])
      .map((item: any) => item.productId)
      .filter((id: any): id is string => typeof id === "string" && id.length > 0);

    const validProductIds = incomingProductIds.length > 0
      ? new Set(
          (await prisma.product.findMany({
            where: { id: { in: incomingProductIds } },
            select: { id: true }
          })).map(p => p.id)
        )
      : new Set<string>();

    // 1. Atomic: create/update Order + decrement Stock within a single transaction
    const order = await prisma.$transaction(async (tx) => {
      const existingPendingOrder = await tx.order.findFirst({
        where: {
          conversationId: paymentPayload.conversationId,
          companyId,
          status: OrderStatus.PENDING,
        },
        include: { orderItems: true, lead: true }
      });

      let result: any;
      if (existingPendingOrder) {
        result = await tx.order.update({
          where: { id: existingPendingOrder.id },
          data: {
            status: OrderStatus.PAID,
            amount: paymentPayload.amount || existingPendingOrder.amount,
            amountInSubunits: BigInt(Math.round(((paymentPayload.amount || existingPendingOrder.amount) || 0) * 100)),
            processedById: userId,
            metadata: {
              ...(existingPendingOrder.metadata as any || {}),
              upiLink: paymentPayload.upiLink,
              isPaymentRequest: true,
              catalogBased: paymentPayload.catalogBased || false
            }
          },
          include: { orderItems: true, lead: true }
        });
      } else {
        result = await tx.order.create({
          data: {
            companyId,
            conversationId: paymentPayload.conversationId,
            leadId: paymentPayload.leadId,
            amount: paymentPayload.amount,
            amountInSubunits: BigInt(Math.round((paymentPayload.amount || 0) * 100)),
            status: OrderStatus.PAID,
            completedAt: null,
            summary: paymentPayload.summary || "Paid Order",
            source: "MANUAL",
            processedById: userId,
            metadata: {
              upiLink: paymentPayload.upiLink,
              isPaymentRequest: true,
              catalogBased: paymentPayload.catalogBased || false
            },
            orderItems: {
              create: (paymentPayload.orderItems || []).map((item: any) => ({
                companyId,
                productId: (item.productId && validProductIds.has(item.productId)) ? item.productId : null,
                sku: item.sku || null,
                name: item.name,
                quantity: item.quantity || 1,
                price: item.price || 0,
                priceInSubunits: BigInt(Math.round((item.price || 0) * 100)),
                cogs: item.cogs || 0,
                cogsInSubunits: BigInt(Math.round((item.cogs || 0) * 100))
              }))
            }
          },
          include: { orderItems: true, lead: true }
        });
      }

      await decrementStockForOrder(result.id, companyId, tx);
      return result;
    });

    // 3. Queue PDF Invoice generation
    const paymentRef = "PAY_" + Date.now();
    await queueProvider.enqueue(PDF_JOB_NAME, { orderId: order.id, paymentRef });

    // 4. Recalculate Lead CRM metrics
    if (order.leadId) {
      await recalculateLeadCRM(order.leadId, companyId);
    }

    // 5. Emit socket & post confirmation system message
    const conv = await prisma.conversation.findFirst({
      where: { id: paymentPayload.conversationId, companyId }
    });

    if (conv) {
      const sysMsg = await prisma.message.create({
        data: {
          content: "✅ Payment Received successfully! Your order is now being processed. An invoice will be generated shortly.",
          sender: MessageSender.SYSTEM,
          conversationId: conv.id,
          companyId
        }
      });
      emitToConversation(conv.id, "new_message", sysMsg);
      safeEmitConversationUpdate(conv as any, "payment_confirmed", order);
    }

    emitToCompany(companyId, "order_created", order);
    emitToCompany(companyId, "order_updated", order);
    emitToCompany(companyId, "dashboard_metrics_updated", { refreshNeeded: true });
    await cacheService.delete(`dashboard_kpis_${companyId}`).catch(() => {});

    businessNotificationService.notifyPaymentStatus({
      companyId,
      orderId: order.id,
      customerName: (order as any).lead?.name || (order as any).lead?.contact,
      amount: order.amount,
      isSuccess: true,
    }).catch((err) => console.error("❌ Payment notification error:", err));

    res.json({
      message: "Payment confirmed and Order created as PAID!",
      order
    });
  } catch (error) {
    console.error("Fulfill payment request error:", error);
    res.status(500).json({ message: "Failed to fulfill payment request" });
  }
});

/* ===============================
   SIMULATE PAYMENT SUCCESS (WEBHOOK MOCK)
================================== */
router.post("/:id/simulate-success", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { companyId, userId, role } = req.user!;
    const userDisplayName = (req.user as any).firstName || (req.user as any).name || "Agent";

    // 1. Find the order with items
    const order = await prisma.order.findUnique({
      where: { id, companyId },
      include: { orderItems: true, lead: true }
    });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === OrderStatus.PAID) return res.status(400).json({ message: "Order is already paid" });

    // 2. Execute status transition via OrderWorkflowService (audit log + state Machine validation)
    const actor = { id: userId, name: userDisplayName, role };
    const { order: updatedOrder } = await orderWorkflowService.transitionStatus(
      companyId,
      id,
      OrderStatus.PAID,
      actor
    );

    // 3. Deferred Stock Decrement: Decrement inventory stock on payment confirmation
    await decrementStockForOrder(id, companyId).catch(err =>
      console.error(`❌ [StockDecrement] Failed for order ${id}:`, err)
    );

    // 4. Queue PDF Invoice generation
    const paymentRef = "MOCK_SIM_" + Date.now();
    await queueProvider.enqueue(PDF_JOB_NAME, { orderId: id, paymentRef });

    // 5. Recalculate Lead CRM metrics
    if (order.leadId) {
      await recalculateLeadCRM(order.leadId, companyId);
    }

    // 6. Find conversation via lead & post System Confirmation Message
    const conv = order.leadId ? await prisma.conversation.findFirst({
      where: { leadId: order.leadId, lifecycleStatus: 'active', companyId }
    }) : null;

    if (conv) {
      const sysMsg = await prisma.message.create({
        data: {
          content: "✅ Payment Received successfully! Your order is now being processed. An invoice will be generated shortly.",
          sender: MessageSender.SYSTEM,
          conversationId: conv.id,
          companyId
        }
      });
      emitToConversation(conv.id, "new_message", sysMsg);
      safeEmitConversationUpdate(conv as any, "payment_confirmed", updatedOrder);
    }

    emitToCompany(companyId, "order_updated", updatedOrder);
    emitToCompany(companyId, "dashboard_metrics_updated", { refreshNeeded: true });
    await cacheService.delete(`dashboard_kpis_${companyId}`).catch(() => {});

    res.json({ 
      message: "Payment successfully simulated! Stock has been auto-deducted and invoice queued.", 
      order: updatedOrder 
    });
  } catch (error) {
    console.error("Simulate success error:", error);
    res.status(500).json({ message: "Failed to simulate payment success" });
  }
});

/* ===============================
   UPDATE STATUS (Lifecycle)
================================== */
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, version } = req.body;
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
        where: { contact: phoneNumber, companyId, deletedAt: null }
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

    // Force cast to allow new fields — wrap Order + OrderItem creation in a
    // single transaction so a partial failure rolls back the entire order.
    const items = req.body.items;
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await (tx.order as any).create({
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
      if (items && Array.isArray(items)) {
        const itemRecords = items.map((item: any) => {
          const itemPrice = Number(item.price) || 0;
          return {
            orderId: createdOrder.id,
            productId: item.productId || null,
            sku: item.sku || null,
            name: item.name,
            quantity: Number(item.quantity) || 1,
            price: itemPrice,
            priceInSubunits: BigInt(Math.round(itemPrice * 100)),
          };
        });

        await tx.orderItem.createMany({
          data: itemRecords
        });
      }

      return createdOrder;
    });

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
      whereCondition.status = { in: ["DELIVERED", "PAID", "COMPLETED", "CANCELLED"] };
      if (!can(req.user, "orders.viewAll")) {
        whereCondition.processedById = req.user!.userId;
      }
    } else {
      // Active Board: Include active stages including PENDING orders awaiting payment confirmation.
      const activeStatuses = ["PENDING", "NEW", "CONFIRMED", "PROCESSING", "PREPARING", "READY", "PAID", "SHIPPED", "COMPLETED"];
      whereCondition.status = { in: activeStatuses };
      if (!can(req.user, "orders.viewAll")) {
        whereCondition.OR = [
          { processedById: req.user!.userId },
          { processedById: null }
        ];
      }
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      tenantDb.order.count({ where: whereCondition }),
      tenantDb.order.findMany({
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
        skip,
        take: limit,
      })
    ]);

    console.log(`[DEBUG] Orders returned:`, orders.map((o: any) => ({ id: o.id, status: o.status, summary: o.summary })));
    return res.json({
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + orders.length < total,
      }
    });
  } catch (error) {
    console.error("Fetch orders error:", error);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

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

    // Atomic claim: single UPDATE with compound WHERE to prevent race condition.
    // Only one concurrent request can win — the others see count=0.
    const claimResult = await prisma.order.updateMany({
      where: {
        id,
        companyId,
        processedById: null, // Must be unclaimed
      },
      data: {
        processedById: userId,
        status: OrderStatus.PENDING,
        updatedAt: new Date(),
      },
    });

    if (claimResult.count === 0) {
      return res.status(409).json({ message: "Order not found or already claimed" });
    }

    // Fetch the full order for response and socket events
    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        lead: { select: { name: true, contact: true } },
        processedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Emit socket events - find conversation via lead for the emit
    const conv = updatedOrder?.leadId ? await prisma.conversation.findFirst({
      where: { leadId: updatedOrder.leadId, lifecycleStatus: 'active' }
    }) : null;
    if (conv && updatedOrder) {
      safeEmitConversationUpdate(conv, "order_updated", updatedOrder);
    }
    if (updatedOrder) {
      emitToAgent(userId, "order_claimed", updatedOrder);
    }

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

    // Agents only see their own assigned/claimed orders unless granted orders.viewAll
    if (!can(req.user, "orders.viewAll")) {
      whereCondition.processedById = userId;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      prisma.order.count({ where: whereCondition }),
      prisma.order.findMany({
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
        skip,
        take: limit,
      })
    ]);

    return res.json({
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + orders.length < total,
      }
    });
  } catch (error) {
    console.error("Fetch awaiting orders error:", error);
    return res.status(500).json({ message: "Failed to fetch awaiting orders" });
  }
});

/* ===============================
   SOFT DELETE ORDER (History Archive)
   🔒 Restricted to: OWNER, ADMIN
================================== */
router.delete("/:id", authMiddleware, authorizePermission("orders.cancel"), async (req: AuthRequest, res: Response) => {
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