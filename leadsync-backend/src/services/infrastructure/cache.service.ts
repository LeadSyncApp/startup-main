import { prisma } from '../../lib/prisma';

type CacheEntry<T> = {
    data: string; // JSON string
    expiry: number;
};

// Simple in-memory cache as a performance optimization
class MemoryCache {
    private cache: Map<string, CacheEntry<any>> = new Map();

    set(key: string, data: any, ttlSeconds: number = 300) {
        this.cache.set(key, {
            data: JSON.stringify(data),
            expiry: Date.now() + ttlSeconds * 1000,
        });
    }

    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        return JSON.parse(entry.data);
    }

    delete(key: string) {
        this.cache.delete(key);
    }
}

class CacheService {
    private memoryCache: MemoryCache = new MemoryCache();

    async tryAcquireLock(key: string, ttlSeconds: number = 300): Promise<boolean> {
        try {
            await prisma.idempotency.create({
                data: {
                    key,
                    result: "locked",
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
                },
            });
            // Performance optimization: add to memory cache
            this.memoryCache.set(key, "locked", ttlSeconds);
            return true; // Lock acquired
        } catch (error: any) {
            // P2002 is unique constraint violation
            if (error.code === 'P2002') {
                return false; // Lock already exists (duplicate)
            }
            throw error; // Other database error
        }
    }

    async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
        this.memoryCache.set(key, data, ttlSeconds);
        // Persist to DB for idempotency
        try {
            await prisma.idempotency.upsert({
                where: { key },
                update: {
                    result: JSON.stringify(data),
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
                },
                create: {
                    key,
                    result: JSON.stringify(data),
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
                },
            });
        } catch (error) {
            console.error(`Cache DB write failed for key ${key}:`, error);
        }
    }

    async get<T>(key: string): Promise<T | null> {
        // Try memory cache first
        const memData = this.memoryCache.get(key);
        if (memData) return memData as T;

        // Try DB
        try {
            const dbEntry = await prisma.idempotency.findUnique({
                where: { key },
            });

            if (!dbEntry) return null;

            if (new Date() > dbEntry.expiresAt) {
                await this.delete(key);
                return null;
            }

            const data = typeof dbEntry.result === 'string' ? JSON.parse(dbEntry.result) : dbEntry.result;
            // Populate memory cache
            this.memoryCache.set(key, data, (dbEntry.expiresAt.getTime() - Date.now()) / 1000);
            return data as T;
        } catch (error) {
            console.error(`Cache DB read failed for key ${key}:`, error);
            return null;
        }
    }

    async delete(key: string): Promise<void> {
        this.memoryCache.delete(key);
        try {
            await prisma.idempotency.deleteMany({
                where: { key: key },
            });
        } catch (e) {
            // Ignore if key not found
        }
    }

    // Helper for company config keys
    getCompanyKey(id: string) {
        return `company:${id}`;
    }

    // Helper for storing pending voice replies (keyed by chat ID)
    getPendingVoiceKey(chatId: string) {
        return `pending_voice:${chatId}`;
    }

    // Helper for storing pending text replies (keyed by chat ID)
    getPendingTextKey(chatId: string) {
        return `pending_text:${chatId}`;
    }
}

export const cacheService = new CacheService();
