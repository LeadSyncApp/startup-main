
import { z } from "zod";
import { getTenantContext } from "../services/context/tenantContext.provider";

// Enforce strict output schema validation at runtime
const OmniResponseSchema = z.object({
  intent_type: z.string(),
  replyText: z.string(),
  thread_summary: z.string(),
  suggested_human_response: z.string()
});

/**
 * Deterministic JSON validation block.
 * Replaces old, expensive regex string-fixing heuristics entirely.
 */
export function validateAndParseOmniResponse(rawContent: string): any {
  try {
    const parsed = JSON.parse(rawContent);
    return OmniResponseSchema.parse(parsed);
  } catch (error) {
    console.error("🚨 [Structural Parsing Fault] LLM output corrupted baseline schema constraints.", error);
    // Return a structured fallback response frame to allow the thread to safely survive the turn
    return {
      intent_type: "HUMAN_HANDOFF",
      replyText: "I'm having trouble processing that request right now. Let me connect you with an agent.",
      thread_summary: "Parsing framework failure fallback turn.",
      suggested_human_response: "System validation fault triggered. Manual interception required."
    };
  }
}

/**
 * Phase 1 AI Helpers
 * - Session Memory (In-memory Map)
 * - Simple Retrieval (Keyword matching)
 * - Menu Snapshot formatting
 * - Sanitization & Safety
 */

export interface CartItem {
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
    color?: string | null;
    size?: string | null;
}

export interface SessionState {
    last_category: string | null;
    last_item_names: string[];
    preferences: {
        color: string | null;
        size: string | null;
        budget_max: number | null;
        purpose: string | null;
    };
    cart: {
        items: CartItem[];
        total: number;
    };
}

// In-memory session store (Phase 1)
const sessions = new Map<string, SessionState>();

export function getSession(tenant_id: string, chat_id: string): SessionState {
    const key = `${tenant_id}:telegram:${chat_id}`;
    if (!sessions.has(key)) {
        sessions.set(key, {
            last_category: null,
            last_item_names: [],
            preferences: {
                color: null,
                size: null,
                budget_max: null,
                purpose: null,
            },
            cart: {
                items: [],
                total: 0
            }
        });
    }
    return sessions.get(key)!;
}

export function updateSession(tenant_id: string, chat_id: string, updates: Partial<SessionState>) {
    const key = `${tenant_id}:telegram:${chat_id}`;
    const current = getSession(tenant_id, chat_id);
    sessions.set(key, { ...current, ...updates });
}

/**
 * Builds a strictly grounded text menu snapshot for injection.
 * Throws a SystemConfigurationException if the context boundaries are violated.
 */
export function getMenuSnapshot(categories: any[]): string {
  const context = getTenantContext();

  // Explicitly guard against missing profile data instead of assuming default configurations
  if (!context.currencySymbol || !context.currencyCode) {
    throw new Error(`SystemConfigurationException: Tenant profile [${context.companyId}] lacks critical currency metadata.`);
  }

  return categories.map((cat) => {
    const itemsText = (cat.products || cat.items || []).map((p: any) => {
      const price = p.price || 0;
      return `- ${p.name}: ${context.currencySymbol}${price} (${context.currencyCode})`;
    }).join("\n");
    return `### ${cat.name}\n${itemsText}`;
  }).join("\n\n");
}

/**
 * Pure deterministic normalization.
 * Replaces high-overhead regex punctuation stripping loops.
 */
export function normalizeSearchQuery(query: string): string {
    if (!query) return "";
    return query.toLowerCase().trim();
}

/**
 * Generates a light, high-level structural map of categories to the LLM.
 * Completely eliminates heavy O(N*M) local string matching algorithms.
 */
export function compileLightMenuContext(categories: any[]): string {
  return categories.map(cat => {
    return `Category: ${cat.name} (ID: ${cat.id}) - Description: ${cat.description || "Available"}`;
  }).join("\n");
}

/**
 * Clear session state for a fresh cart session
 */
export function validateStateUpdates(raw: any, baseState: SessionState): SessionState {
    if (!raw || typeof raw !== 'object') return baseState;
    
    // Create a deeply cloned fallback to mutate
    const safeBase = JSON.parse(JSON.stringify(baseState)) as SessionState;

    const safeState: SessionState = { ...safeBase };

    if (raw.last_category !== undefined) {
        safeState.last_category = typeof raw.last_category === 'string' ? raw.last_category : null;
    }
    
    if (Array.isArray(raw.last_item_names)) {
        safeState.last_item_names = raw.last_item_names.filter((n: any) => typeof n === 'string');
    }

    if (raw.preferences && typeof raw.preferences === 'object') {
        const p = raw.preferences;
        safeState.preferences = {
            color: typeof p.color === 'string' ? p.color : safeBase.preferences.color,
            size: typeof p.size === 'string' ? p.size : safeBase.preferences.size,
            budget_max: typeof p.budget_max === 'number' ? p.budget_max : safeBase.preferences.budget_max,
            purpose: typeof p.purpose === 'string' ? p.purpose : safeBase.preferences.purpose,
        };
    }

    if (raw.cart && typeof raw.cart === 'object') {
        const items = Array.isArray(raw.cart.items) ? raw.cart.items : safeBase.cart.items || [];
        const safeItems: CartItem[] = [];
        let calculatedTotal = 0;

        for (const item of items) {
            if (item && typeof item === 'object' && typeof item.name === 'string' && typeof item.price === 'number' && typeof item.quantity === 'number' && item.quantity > 0) {
                const subtotal = item.quantity * item.price;
                safeItems.push({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    subtotal: typeof item.subtotal === 'number' ? item.subtotal : subtotal,
                    color: typeof item.color === 'string' ? item.color : null,
                    size: typeof item.size === 'string' ? item.size : null
                });
                calculatedTotal += subtotal;
            }
        }

        safeState.cart = {
            items: safeItems,
            total: typeof raw.cart.total === 'number' && raw.cart.total > 0 ? raw.cart.total : calculatedTotal
        };
    }

    return safeState;
}

export function createFreshSessionState(): SessionState {
    return {
        last_category: null,
        last_item_names: [],
        preferences: {
            color: null,
            size: null,
            budget_max: null,
            purpose: null,
        },
        cart: {
            items: [],
            total: 0
        }
    };
}

/**
 * Context-Aware Currency Formatter.
 * Zero hardcoded fallbacks, zero local structural leakage.
 */
export function formatCurrencyContextually(amount: number): string {
  const context = getTenantContext();
  return `${context.currencySymbol}${amount.toFixed(2)} (${context.currencyCode})`;
}
