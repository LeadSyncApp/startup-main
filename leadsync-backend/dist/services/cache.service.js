"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 300 * 1000; // 5 minutes in milliseconds
    }
    set(key, data, ttlSeconds = 300) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttlSeconds * 1000,
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    delete(key) {
        this.cache.delete(key);
    }
    // Helper for company config keys
    getCompanyKey(id) {
        return `company:${id}`;
    }
}
exports.cacheService = new MemoryCache();
