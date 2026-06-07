
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

export function getMenuSnapshot(structuredMenu: any, products?: any[]) {
    try {
        const fs = require("fs");
        fs.appendFileSync("/bot_debug.log", `[getMenuSnapshot] Called at ${new Date().toISOString()}. structuredMenu exists: ${!!structuredMenu}, products length: ${products?.length || 0}\n`);
        if (products && products.length > 0) {
            fs.appendFileSync("/bot_debug.log", `[getMenuSnapshot] Raw products list: ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, isActive: p.isActive, category: p.category })))}\n`);
        }
    } catch (err) {}

    // Priority 1: Use the Relational Product Table (Master Catalog)
    const activeProducts = (products || []).filter((p: any) => p.isActive !== false);
    if (activeProducts && activeProducts.length > 0) {
        // Group products by category
        const categoriesMap: Record<string, any[]> = {};
        activeProducts.forEach((p: any) => {
            const cat = p.category || "Uncategorized";
            if (!categoriesMap[cat]) categoriesMap[cat] = [];
            categoriesMap[cat].push({
                item_id: p.id,
                name: p.name,
                price: p.price,
                currency: "INR",
                category: cat
            });
        });

        return {
            categories: Object.entries(categoriesMap).map(([name, items]) => ({
                name,
                items
            }))
        };
    }

    // Priority 2: Fallback to the Legacy JSON blob (botStructuredMenu)
    if (!structuredMenu || !structuredMenu.categories) {
        return { categories: [] };
    }
    return {
        categories: structuredMenu.categories.map((cat: any) => ({
            name: cat.name,
            items: cat.items.map((item: any) => ({
                item_id: item.id || item.item_id,
                name: item.name,
                price: item.price,
                currency: item.currency || "INR",
                category: cat.name
            }))
        }))
    };
}

export function calculateRetrieval(query: string, menuSnapshot: any) {
    const normalizedQuery = query.toLowerCase().replace(/[-_/,;:!?()]/g, " ");
    const tokens = normalizedQuery.split(/\s+/).filter(t => t.length >= 2);
    const items: any[] = [];

    menuSnapshot.categories.forEach((cat: any) => {
        cat.items.forEach((item: any) => {
            const itemName = item.name.toLowerCase();
            let score = 0;

            // Exact match
            if (itemName === query.toLowerCase()) score += 10;

            // Substring match
            if (itemName.includes(query.toLowerCase())) score += 5;

            // Token overlap
            tokens.forEach(token => {
                if (itemName.includes(token)) score += 2;
            });

            if (score > 0) {
                items.push({ ...item, score });
            }
        });
    });

    // Return top 8 items sorted by score
    return items.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function safeJsonParse(text: string, fallback: any = null) {
    try {
        if (!text) return fallback;

        // 1. Pre-clean: Remove any markdown backticks if they exist
        let cleaned = text.replace(/```json\n?|```/gi, "").trim();

        // 2. Extract JSON block (from first '{' to last '}')
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        // 3. Handle common model error: unescaped newlines in strings
        // This regex finds content inside quotes and ensures newlines are escaped
        const fixed = cleaned.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/gs, (match) => {
            return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
        });

        return JSON.parse(fixed);
    } catch (e) {
        console.error("❌ [JSON Parse Error] Raw:", text);
        return fallback;
    }
}

export function sanitizeReply(text: string): string {
    if (!text) return "";
    // Remove markdown block backticks
    let cleaned = text.replace(/```[a-z]*\n?|```/gi, "").trim();
    // Remove bold and italics
    cleaned = cleaned.replace(/\*\*|\*/g, "");
    
    // DELIBERATELY RETAINING EMOJIS: Emojis are vital for natural chatbot communication (like ✅, 📦, 🚚).
    // Remove any leftover hallucinated XML tool tags
    cleaned = cleaned.replace(/<(?:function|tool_call|invoke)[^>]*>[\s\S]*?<\/(?:function|tool_call|invoke)>/gi, "");
    
    return cleaned.trim();
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
