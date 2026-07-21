import { prisma } from "../../lib/prisma";
import { DraftOrderStatus } from "@prisma/client";
import { newOrderArrivalService } from "../workflow/newOrderArrival.service";
import { processAiTriageJob } from "../workers/ai.triage.worker";

export interface DraftOrderItem {
  name: string;
  quantity: number;
  price: number;
  inventoryProductId?: string | null;
  productId: string | null;
  sku: string | null;
  isMatched: boolean;
}

export interface ResolveItemsResult {
  resolvedItems: DraftOrderItem[];
  allMatched: boolean;
  resolvedTotal: number;
}

/**
 * 🧹 Auto-abandons active draft orders that are expired or idle for > 24 hours.
 */
export async function expireStaleDraftOrders(conversationId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  const now = new Date();

  await prisma.draftOrder.updateMany({
    where: {
      conversationId,
      status: { in: [DraftOrderStatus.DRAFTING, DraftOrderStatus.AWAITING_CONFIRMATION] },
      OR: [
        { expiresAt: { lt: now } },
        { updatedAt: { lt: cutoff } }
      ]
    },
    data: {
      status: DraftOrderStatus.ABANDONED
    }
  });
}

/**
 * 🔄 Synchronizes Lead pendingOrderAmount and Conversation intent with active DraftOrder state.
 * If an active draft order exists in DRAFTING or AWAITING_CONFIRMATION:
 * - lead.pendingOrderAmount = draft.totalAmount
 * - conversation.intent = ConversationIntent.ORDERING
 * If NO active draft order exists (e.g. ABANDONED, CONFIRMED, or cleared):
 * - lead.pendingOrderAmount = null
 * - Triggers immediate AI re-triage of recent conversation messages to evaluate true intent (Option a).
 */
export async function syncLeadPendingOrderState(
  companyId: string,
  leadId: string | null,
  conversationId: string
): Promise<void> {
  const activeDraft = await prisma.draftOrder.findFirst({
    where: {
      conversationId,
      companyId,
      status: { in: [DraftOrderStatus.DRAFTING, DraftOrderStatus.AWAITING_CONFIRMATION] }
    },
    orderBy: { updatedAt: "desc" }
  });

  if (activeDraft && activeDraft.totalAmount > 0) {
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { pendingOrderAmount: activeDraft.totalAmount }
      });
    }
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { intent: "ORDERING" as any }
    });
  } else {
    // Reset path when active draft order is gone/abandoned/confirmed
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { pendingOrderAmount: null }
      });
    }
    // Re-triage conversation using actual recent messages instead of hardcoding BROWSING
    try {
      await processAiTriageJob({
        id: `triage-reset-${conversationId}-${Date.now()}`,
        data: { conversationId, companyId }
      });
    } catch (err: any) {
      console.error(`[DraftOrder] Failed to re-triage conversation ${conversationId} after draft clear:`, err.message);
    }
  }
}


/**
 * 🔍 Retrieves the single active draft order for a conversation.
 * Automatically cleans up stale drafts first. If multiple active drafts exist,
 * marks older ones as ABANDONED so only 1 active draft exists.
 */
export async function getActiveDraftOrder(companyId: string, conversationId: string): Promise<any | null> {
  await expireStaleDraftOrders(conversationId);

  const activeDrafts = await prisma.draftOrder.findMany({
    where: {
      conversationId,
      companyId,
      status: { in: [DraftOrderStatus.DRAFTING, DraftOrderStatus.AWAITING_CONFIRMATION] }
    },
    orderBy: { updatedAt: "desc" }
  });

  if (activeDrafts.length === 0) {
    return null;
  }

  // Deduplicate if multiple active drafts exist (abandon older ones)
  if (activeDrafts.length > 1) {
    const [latest, ...stale] = activeDrafts;
    const staleIds = stale.map((d) => d.id);
    await prisma.draftOrder.updateMany({
      where: { id: { in: staleIds } },
      data: { status: DraftOrderStatus.ABANDONED }
    });
    return latest;
  }

  return activeDrafts[0];
}

/**
 * 🛒 Strictly READ-ONLY matching of extracted items against InventoryProduct and InventoryVariant.
 * Ensures items get canonical base prices from DB, not hallucinated prices.
 */
export async function resolveAndValidateItems(companyId: string, rawItems: any[]): Promise<ResolveItemsResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { resolvedItems: [], allMatched: false, resolvedTotal: 0 };
  }

  const resolvedItems: DraftOrderItem[] = [];
  let resolvedTotal = 0;
  let allMatched = true;

  for (const item of rawItems) {
    const itemName = (item.name || "").trim();
    const qty = Math.max(1, parseInt(item.quantity) || 1);
    if (!itemName) continue;

    // 1. Exact match (case insensitive)
    let dbProduct = await prisma.inventoryProduct.findFirst({
      where: { companyId, isActive: true, name: { equals: itemName, mode: "insensitive" } }
    });

    // 2. Fuzzy contains match
    if (!dbProduct) {
      dbProduct = await prisma.inventoryProduct.findFirst({
        where: { companyId, isActive: true, name: { contains: itemName, mode: "insensitive" } }
      });
    }

    // 3. Reverse search: item string contains product name or product name contains item string
    if (!dbProduct) {
      const allProducts = await prisma.inventoryProduct.findMany({
        where: { companyId, isActive: true }
      });
      dbProduct = allProducts.find((p) =>
        itemName.toLowerCase().includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(itemName.toLowerCase())
      ) || null;
    }

    let matchedVariantId: string | null = null;
    if (dbProduct?.hasVariants) {
      const variants = await prisma.inventoryVariant.findMany({
        where: { productId: dbProduct.id, isActive: true }
      });
      const matched = variants.find((v) =>
        new RegExp(`\\b${v.attributeValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(itemName)
      );
      if (matched) matchedVariantId = matched.id;
    }

    const isMatched = !!dbProduct;
    if (!isMatched) {
      allMatched = false;
    }

    const price = dbProduct?.basePrice ?? (typeof item.price === "number" ? item.price : 0);
    const lineTotal = price * qty;
    resolvedTotal += lineTotal;

    resolvedItems.push({
      name: dbProduct?.name || itemName,
      quantity: qty,
      price,
      inventoryProductId: dbProduct?.id || null,
      productId: null,
      sku: matchedVariantId || dbProduct?.sku || null,
      isMatched
    });
  }

  return {
    resolvedItems,
    allMatched: resolvedItems.length > 0 && allMatched,
    resolvedTotal
  };
}

/**
 * 📝 Creates or updates a structured DraftOrder record for a conversation.
 * Status transitions to AWAITING_CONFIRMATION ONLY when ALL items have validated DB matches.
 */
export async function syncDraftOrderFromAi(params: {
  companyId: string;
  conversationId: string;
  leadId?: string;
  extractedOrder?: any;
  rawUserMessage?: string;
}): Promise<any> {
  const { companyId, conversationId, leadId, extractedOrder } = params;

  if (!extractedOrder || !Array.isArray(extractedOrder.items) || extractedOrder.items.length === 0) {
    return await getActiveDraftOrder(companyId, conversationId);
  }

  const { resolvedItems, allMatched, resolvedTotal } = await resolveAndValidateItems(companyId, extractedOrder.items);
  if (resolvedItems.length === 0) {
    return await getActiveDraftOrder(companyId, conversationId);
  }

  const activeDraft = await getActiveDraftOrder(companyId, conversationId);

  // Status transitions to AWAITING_CONFIRMATION ONLY if all items have canonical DB matches AND no follow-up needed
  const targetStatus = (allMatched && !extractedOrder.needs_follow_up)
    ? DraftOrderStatus.AWAITING_CONFIRMATION
    : DraftOrderStatus.DRAFTING;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiration

  const recipientName = extractedOrder.recipient_name || activeDraft?.recipientName || null;
  const recipientPhone = extractedOrder.recipient_phone || activeDraft?.recipientPhone || null;
  const shippingAddress = extractedOrder.address_details || activeDraft?.shippingAddress || null;

  if (activeDraft) {
    // Update existing active draft in place
    return await prisma.draftOrder.update({
      where: { id: activeDraft.id },
      data: {
        items: resolvedItems as any,
        totalAmount: resolvedTotal,
        status: targetStatus,
        recipientName,
        recipientPhone,
        shippingAddress,
        expiresAt,
        leadId: leadId || activeDraft.leadId
      }
    });
  } else {
    // Create a new active draft
    return await prisma.draftOrder.create({
      data: {
        companyId,
        conversationId,
        leadId,
        items: resolvedItems as any,
        totalAmount: resolvedTotal,
        status: targetStatus,
        recipientName,
        recipientPhone,
        shippingAddress,
        expiresAt
      }
    });
  }
}

/**
 * ✅ Confirms an active DraftOrder, creating the real Order and setting status = CONFIRMED.
 * Prevents duplicate orders by checking if DraftOrder is currently in AWAITING_CONFIRMATION or DRAFTING.
 */
export async function confirmActiveDraftOrder(companyId: string, conversationId: string): Promise<{
  order: any | null;
  draftOrder: any | null;
  reason?: string;
}> {
  const activeDraft = await getActiveDraftOrder(companyId, conversationId);

  if (!activeDraft) {
    console.log(`🛡️ [DraftOrderService] No active draft order found for conversation ${conversationId}. Confirmation skipped.`);
    return { order: null, draftOrder: null, reason: "NO_ACTIVE_DRAFT" };
  }

  const items = (activeDraft.items as any[]) || [];
  if (items.length === 0) {
    console.log(`🛡️ [DraftOrderService] Draft order ${activeDraft.id} has no items. Confirmation skipped.`);
    return { order: null, draftOrder: activeDraft, reason: "NO_ITEMS_IN_DRAFT" };
  }

  // Ensure DB dedup: check if a real non-terminal order was created for this conversation in the last 60 seconds
  const recentOrder = await prisma.order.findFirst({
    where: {
      conversationId,
      isDeleted: false,
      createdAt: { gte: new Date(Date.now() - 60 * 1000) }
    }
  });

  if (recentOrder) {
    console.log(`🛡️ [DraftOrderService] Order ${recentOrder.id} was already created recently for conversation ${conversationId}. Marking draft as CONFIRMED.`);
    const updatedDraft = await prisma.draftOrder.update({
      where: { id: activeDraft.id },
      data: { status: DraftOrderStatus.CONFIRMED }
    });
    return { order: recentOrder, draftOrder: updatedDraft, reason: "ALREADY_CONFIRMED_RECENTLY" };
  }

  // Create real Order via newOrderArrivalService
  const orderData = {
    companyId,
    conversationId,
    leadId: activeDraft.leadId,
    summary: `AI Order: ${items.map((i: any) => `${i.name} x${i.quantity}`).join(", ") || "Unknown Items"}`,
    amount: activeDraft.totalAmount,
    items: items.map((i: any) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      productId: i.productId,
      sku: i.sku
    })),
    source: "BOT_DETECTED" as any
  };

  try {
    const createdOrder = await newOrderArrivalService.processNewOrderArrival(orderData);

    // Transition DraftOrder status to CONFIRMED
    const updatedDraft = await prisma.draftOrder.update({
      where: { id: activeDraft.id },
      data: { status: DraftOrderStatus.CONFIRMED }
    });

    console.log(`✅ [DraftOrderService] Successfully confirmed draft ${activeDraft.id} -> created Order ${createdOrder.id} for amount ₹${activeDraft.totalAmount}`);
    return { order: createdOrder, draftOrder: updatedDraft };
  } catch (err: any) {
    console.error(`❌ [DraftOrderService] Failed to process order arrival for draft ${activeDraft.id}:`, err.message);
    throw err;
  }
}
