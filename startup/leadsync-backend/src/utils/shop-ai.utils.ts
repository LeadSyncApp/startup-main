
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

export function getMenuSnapshot(structuredMenu: any) {
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
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
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
    // Removed the aggressive emoji filter regex.
    return cleaned;
}

/**
 * Clear session state for a fresh cart session
 */
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
