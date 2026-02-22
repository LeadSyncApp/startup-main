
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
        // Attempt to extract JSON if there's markdown or extra text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse AI JSON:", text);
        return fallback;
    }
}

export function sanitizeReply(text: string): string {
    if (!text) return "";
    // Remove markdown
    let cleaned = text.replace(/```[a-z]*\n?|```/gi, "").trim();
    cleaned = cleaned.replace(/\*\*|\*/g, "");
    // Remove emojis
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");
    return cleaned;
}
