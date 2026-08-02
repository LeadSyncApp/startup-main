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

  if (activeDraft && activeDraft.totalAmountInSubunits > 0n) {
    if (leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
      if (lead) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { pendingOrderAmount: Number(activeDraft.totalAmountInSubunits) / 100 }
        });
      }
    }
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { intent: "ORDERING" as any }
    });
  } else {
    // Reset path when active draft order is gone/abandoned/confirmed
    if (leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
      if (lead) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { pendingOrderAmount: null }
        });
      }
    }
    // Re-triage conversation using actual recent messages instead of hardcoding BROWSING
    // Fire-and-forget: triage was already triggered at the top of the orchestrator
    // worker (line ~210). This is a safety net for the edge case where the
    // conversation had no draft at pipeline entry but acquired (then lost) one
    // mid-pipeline. We don't block the dispatch on it.
    processAiTriageJob({
      id: `triage-reset-${conversationId}-${Date.now()}`,
      data: { conversationId, companyId }
    }).catch((err: any) => {
      console.error(`[DraftOrder] Failed to re-triage conversation ${conversationId} after draft clear:`, err.message);
    });
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
 *
 * Batched optimization: loads full product catalog once, runs exact+fuzzy queries
 * in parallel across all items, and batches variant lookups — reducing ~12-14
 * sequential DB round-trips to ~3-4 total.
 */
export async function resolveAndValidateItems(companyId: string, rawItems: any[], rawUserMessage?: string): Promise<ResolveItemsResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { resolvedItems: [], allMatched: false, resolvedTotal: 0 };
  }

  // Filter out items with empty names upfront
  const validItems = rawItems.filter((item) => (item.name || "").trim());
  if (validItems.length === 0) {
    return { resolvedItems: [], allMatched: false, resolvedTotal: 0 };
  }

  // ── STEP 1: Load full product catalog ONCE (covers reverse-match for all items) ──
  const allProducts = await prisma.inventoryProduct.findMany({
    where: { companyId, isActive: true }
  });

  // ── STEP 2: Run all exact+fuzzy findFirst queries in parallel ──
  const matchPromises = validItems.map(async (item) => {
    const itemName = (item.name || "").trim();

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
    // Uses pre-fetched catalog instead of re-querying DB
    if (!dbProduct) {
      dbProduct = allProducts.find((p) =>
        itemName.toLowerCase().includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(itemName.toLowerCase())
      ) || null;
    }

    return { item, dbProduct };
  });

  const matchResults = await Promise.all(matchPromises);

  // ── STEP 3: Batch variant lookups for all products that need them ──
  const productIdsNeedingVariants = [
    ...new Set(
      matchResults
        .filter((r) => r.dbProduct?.hasVariants)
        .map((r) => r.dbProduct!.id)
    )
  ];

  let variantMap = new Map<string, any[]>();
  if (productIdsNeedingVariants.length > 0) {
    const allVariants = await prisma.inventoryVariant.findMany({
      where: { productId: { in: productIdsNeedingVariants }, isActive: true }
    });

    // Group variants by productId for O(1) lookup
    for (const variant of allVariants) {
      const existing = variantMap.get(variant.productId) || [];
      existing.push(variant);
      variantMap.set(variant.productId, existing);
    }
  }

  // ── STEP 4: Build resolved items using batched results ──
  const resolvedItems: DraftOrderItem[] = [];
  let resolvedTotal = 0;
  let allMatched = true;

  for (const { item, dbProduct } of matchResults) {
    const itemName = (item.name || "").trim();
    const qty = Math.max(1, parseInt(item.quantity) || 1);

    let matchedVariantId: string | null = null;
    if (dbProduct?.hasVariants) {
      const variants = variantMap.get(dbProduct.id) || [];
      const textToTest = `${itemName} ${rawUserMessage || ""}`.trim();

      // 1. Exact regex match of attributeValue
      let matched = variants.find((v) =>
        new RegExp(`\\b${v.attributeValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(textToTest)
      );

      // 2. Token / word match for variant attributes (e.g. "L", "Size L", "RED", "M", "S")
      if (!matched) {
        matched = variants.find((v) => {
          const parts = v.attributeValue.split(/[\/\-\s]+/).map((p: string) => p.trim()).filter(Boolean);
          return parts.some((part: string) => {
            if (part.length === 1 || ["S", "M", "L", "XL", "XXL"].includes(part.toUpperCase())) {
              return new RegExp(`\\b(size\\s*)?${part}\\b`, "i").test(textToTest);
            }
            return new RegExp(`\\b${part}\\b`, "i").test(textToTest);
          });
        });
      }

      if (matched) matchedVariantId = matched.id;
    }

    const isMatched = !!dbProduct;
    if (!isMatched) {
      allMatched = false;
    }

    const basePriceFloat = dbProduct?.basePriceInSubunits ? Number(dbProduct.basePriceInSubunits) / 100 : null;
    const price = basePriceFloat ?? (typeof item.price === "number" ? item.price : 0);
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
  const { companyId, conversationId, leadId, extractedOrder, rawUserMessage } = params;

  if (!extractedOrder || !Array.isArray(extractedOrder.items) || extractedOrder.items.length === 0) {
    return await getActiveDraftOrder(companyId, conversationId);
  }

  const { resolvedItems, allMatched, resolvedTotal } = await resolveAndValidateItems(companyId, extractedOrder.items, rawUserMessage);
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

  const totalAmountSubunits = BigInt(Math.round((resolvedTotal || 0) * 100));

  if (activeDraft) {
    // Update existing active draft in place
    return await prisma.draftOrder.update({
      where: { id: activeDraft.id },
      data: {
        items: resolvedItems as any,
        totalAmount: resolvedTotal,
        totalAmountInSubunits: totalAmountSubunits,
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
        totalAmountInSubunits: totalAmountSubunits,
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

  // 🛡️ CHECK REQUIRED ATTRIBUTES: Ensure all items with variants have a specific variant selected
  const productIds = items
    .map((i: any) => i.inventoryProductId)
    .filter((id: any): id is string => typeof id === "string" && id.length > 0);

  if (productIds.length > 0) {
    const productsWithVariants = await prisma.inventoryProduct.findMany({
      where: { id: { in: productIds }, hasVariants: true, companyId },
      include: { variants: { where: { isActive: true } } }
    });

    for (const item of items) {
      const prod = productsWithVariants.find((p) => p.id === item.inventoryProductId);
      if (prod && prod.hasVariants && prod.variants.length > 0) {
        const variantSkus = new Set(prod.variants.map((v) => v.sku).filter(Boolean));
        const variantIds = new Set(prod.variants.map((v) => v.id));
        const isVariantResolved =
          (item.sku && (variantSkus.has(item.sku) || variantIds.has(item.sku))) ||
          (item.variantId && variantIds.has(item.variantId));

        if (!isVariantResolved) {
          console.log(`🛡️ [DraftOrderService] Product "${prod.name}" has variants but no specific variant is selected for item "${item.name}". Skipping order confirmation until attributes are specified.`);
          return { order: null, draftOrder: activeDraft, reason: "UNRESOLVED_VARIANT_ATTRIBUTES" };
        }
      }
    }
  }

  // Verify: check if an active non-terminal order already exists for this conversation
  const existingOrder = await prisma.order.findFirst({
    where: {
      conversationId,
      isDeleted: false,
      status: { notIn: ["CANCELLED", "REJECTED"] }
    },
    orderBy: { createdAt: "desc" }
  });

  if (existingOrder) {
    console.log(`🛡️ [DraftOrderService] Order ${existingOrder.id} already exists for conversation ${conversationId}. Marking draft as CONFIRMED.`);
    await prisma.draftOrder.update({
      where: { id: activeDraft.id },
      data: { status: DraftOrderStatus.CONFIRMED }
    });
    return { order: existingOrder, draftOrder: activeDraft, reason: "ORDER_ALREADY_EXISTS" };
  }

  // Atomic claim: lock draft status to prevent concurrent confirmations before order creation
  const claimed = await prisma.draftOrder.updateMany({
    where: {
      id: activeDraft.id,
      status: { in: [DraftOrderStatus.AWAITING_CONFIRMATION, DraftOrderStatus.DRAFTING] },
    },
    data: { status: DraftOrderStatus.CONFIRMED },
  });

  if (claimed.count === 0) {
    console.log(`🛡️ [DraftOrderService] Draft ${activeDraft.id} already claimed/confirmed. Skipping.`);
    const refreshed = await prisma.draftOrder.findUnique({ where: { id: activeDraft.id } });
    return { order: null, draftOrder: refreshed, reason: "ALREADY_CLAIMED" };
  }

  // Create real Order via newOrderArrivalService
  const orderData = {
    companyId,
    conversationId,
    leadId: activeDraft.leadId,
    summary: `AI Order: ${items.map((i: any) => `${i.name} x${i.quantity}`).join(", ") || "Unknown Items"}`,
    amount: Number(activeDraft.totalAmountInSubunits) / 100,
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

    console.log(`✅ [DraftOrderService] Successfully confirmed draft ${activeDraft.id} -> created Order ${createdOrder.id} for amount ₹${Number(activeDraft.totalAmountInSubunits) / 100}`);
    return { order: createdOrder, draftOrder: activeDraft };
  } catch (err: any) {
    // Revert draft status on failure so it can be retried
    await prisma.draftOrder.update({
      where: { id: activeDraft.id },
      data: { status: DraftOrderStatus.AWAITING_CONFIRMATION }
    }).catch(() => {});
    console.error(`❌ [DraftOrderService] Failed to process order arrival for draft ${activeDraft.id}:`, err.message);
    throw err;
  }
}
