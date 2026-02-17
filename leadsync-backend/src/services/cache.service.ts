type CacheEntry<T> = {
    data: T;
    expiry: number;
};

class MemoryCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL: number = 300 * 1000; // 5 minutes in milliseconds

    constructor() { }

    set<T>(key: string, data: T, ttlSeconds: number = 300) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttlSeconds * 1000,
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    delete(key: string) {
        this.cache.delete(key);
    }

    // Helper for company config keys
    getCompanyKey(id: string) {
        return `company:${id}`;
    }
}

export const cacheService = new MemoryCache();
