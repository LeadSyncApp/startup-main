import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { prisma } from "./prisma";

let io: Server | null = null;

// ============================================================
// Heartbeat tracking
// Maps userId -> timestamp of last ping received
// ============================================================
const userHeartbeats = new Map<string, number>();
const HEARTBEAT_TIMEOUT_MS = 90_000; // 90s no ping = offline
const CLEANUP_INTERVAL_MS = 30_000;  // check every 30s

// ============================================================
// Per-Company Visitor Socket Concurrency Cap
// Max 100 concurrent visitor socket connections per store workspace
// ============================================================
export const MAX_VISITOR_CONCURRENCY_PER_COMPANY = 100;
const activeVisitorSocketsPerCompany = new Map<string, Set<string>>();

function registerVisitorSocket(companyId: string, socketId: string): boolean {
    if (!companyId) return true;
    let set = activeVisitorSocketsPerCompany.get(companyId);
    if (!set) {
        set = new Set<string>();
        activeVisitorSocketsPerCompany.set(companyId, set);
    }
    if (set.has(socketId)) return true;
    if (set.size >= MAX_VISITOR_CONCURRENCY_PER_COMPANY) {
        return false;
    }
    set.add(socketId);
    return true;
}

function removeVisitorSocket(socketId: string) {
    for (const [companyId, set] of activeVisitorSocketsPerCompany.entries()) {
        if (set.has(socketId)) {
            set.delete(socketId);
            if (set.size === 0) activeVisitorSocketsPerCompany.delete(companyId);
        }
    }
}

/**
 * On server startup, reset all users to offline so that stale
 * "isOnline: true" from a previous crash/restart is cleared.
 */
async function resetAllUsersOffline() {
    try {
        const result = await prisma.user.updateMany({
            where: { isOnline: true },
            data: { isOnline: false, lastSeenAt: new Date() },
        });
        console.log(`🔄 [Socket Init] Reset ${result.count} users to offline on startup`);
    } catch (err) {
        console.error("❌ [Socket Init] Failed to reset users offline:", err);
    }
}

/**
 * Periodic cleanup: marks users offline if their last heartbeat
 * is older than HEARTBEAT_TIMEOUT_MS.
 */
async function cleanupStaleHeartbeats() {
    const now = Date.now();
    const stale: string[] = [];

    for (const [userId, lastPing] of userHeartbeats.entries()) {
        if (now - lastPing > HEARTBEAT_TIMEOUT_MS) {
            stale.push(userId);
        }
    }

    if (stale.length === 0) return;

    // Batch update in DB
    try {
        await prisma.user.updateMany({
            where: { id: { in: stale } },
            data: { isOnline: false, lastSeenAt: new Date() },
        });
        console.log(`🧹 [Socket Cleanup] Marked ${stale.length} stale users offline`);
    } catch (err) {
        console.error("❌ [Socket Cleanup] Failed:", err);
    }

    // Remove from tracking map
    for (const id of stale) {
        userHeartbeats.delete(id);
    }
}

export const initSocket = (httpServer: HttpServer) => {
    // 🔁 Reset stale online flags on every server start
    resetAllUsersOffline();

    // 🧹 Start periodic stale heartbeat cleanup
    const cleanupTimer = setInterval(cleanupStaleHeartbeats, CLEANUP_INTERVAL_MS);

    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PATCH", "DELETE"]
        },
    });

    io.on("connection", async (socket) => {
        console.log(`🔌 New socket connection: ${socket.id}`);

        socket.on("join_company", (companyId: string) => {
            socket.join(`company:${companyId}`);
            console.log(`🏢 Socket ${socket.id} joined company room: company:${companyId}`);
        });

        socket.on("join_user", (userId: string) => {
            socket.join(`user:${userId}`);
            console.log(`👤 Socket ${socket.id} joined user room: user:${userId}`);
        });

        socket.on("join_admin", (companyId: string) => {
            socket.join(`company:${companyId}:admin`);
            console.log(`🛡️ Socket ${socket.id} joined admin room: company:${companyId}:admin`);
        });

        socket.on("join_conversation", (conversationId: string) => {
            if (conversationId) {
                socket.join(conversationId);
                socket.join(`conversation:${conversationId}`);
                console.log(`💬 Socket ${socket.id} joined conversation room: ${conversationId}`);
            }
        });

        socket.on("join_visitor", (payload: any) => {
            const token = typeof payload === "string" ? payload : payload?.visitorToken;
            const phone = typeof payload === "object" ? payload?.phone : null;
            const companyId = typeof payload === "object" ? payload?.companyId : null;

            if (companyId) {
                const allowed = registerVisitorSocket(companyId, socket.id);
                if (!allowed) {
                    console.warn(`⚠️ [Socket Cap] Exceeded max visitor concurrency (${MAX_VISITOR_CONCURRENCY_PER_COMPANY}) for company: ${companyId}`);
                    socket.emit("visitor_limit_exceeded", {
                        message: "Store chat high traffic. Please try again shortly."
                    });
                    return;
                }
            }

            if (token) {
                socket.join(`visitor:${token}`);
                console.log(`💬 Socket ${socket.id} joined visitor room: visitor:${token}`);
            }
            if (phone) {
                const cleanPhone = String(phone).replace(/[^0-9]/g, "");
                if (cleanPhone) {
                    socket.join(`visitor:${cleanPhone}`);
                    console.log(`💬 Socket ${socket.id} joined visitor room: visitor:${cleanPhone}`);
                }
            }
        });

        socket.on("disconnect", async () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
            removeVisitorSocket(socket.id);
            // Check if this socket was associated with a user
            const userId = socket.data?.userId;
            if (userId) {
                // Remove from heartbeat tracking
                userHeartbeats.delete(userId);

                // Check if user has OTHER active sockets still connected
                const sockets = await io?.sockets.sockets || new Map();
                let hasOtherSocket = false;
                for (const [, s] of sockets) {
                    if (s.data?.userId === userId && s.id !== socket.id) {
                        hasOtherSocket = true;
                        break;
                    }
                }

                if (!hasOtherSocket) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { isOnline: false, lastSeenAt: new Date() },
                    }).catch(err => console.error("Failed to update user online status on disconnect:", err));
                }
            }
        });

        // Track which user this socket belongs to
        socket.on("register_user", async (payload: { userId: string; companyId: string; userName?: string }) => {
            socket.data.userId = payload.userId;
            socket.data.companyId = payload.companyId;
            socket.data.userName = payload.userName;
            // Also join the user room
            socket.join(`user:${payload.userId}`);
            // Initialise heartbeat timestamp
            userHeartbeats.set(payload.userId, Date.now());
            // Mark user as online in DB
            try {
                await prisma.user.update({
                    where: { id: payload.userId },
                    data: { isOnline: true, lastSeenAt: new Date() },
                });
            } catch (err) {
                console.error("❌ Failed to mark user online on register:", err);
            }
            console.log(`👤 Socket ${socket.id} registered to user: ${payload.userId} @ company:${payload.companyId}`);
        });

        // Client-side heartbeat ping — the frontend sends this periodically
        socket.on("heartbeat", async (userId: string) => {
            if (userId) {
                socket.data.userId = userId;
                userHeartbeats.set(userId, Date.now());
                // Also persist to DB so HTTP-based staleness check is accurate
                try {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { isOnline: true, lastSeenAt: new Date() },
                    });
                } catch (err) {
                    console.error("❌ Failed to persist socket heartbeat:", err);
                }
            }
        });
    });

    // Clean up the interval timer when the server closes
    io.engine.on("close", () => {
        clearInterval(cleanupTimer);
    });

    return io;
};

export const initializeClusteredSockets = initSocket;

export const getIO = () => io;

export const emitToCompany = (companyId: string, event: string, data: any) => {
    if (io) io.to(`company:${companyId}`).emit(event, data);
};

export const emitToCompanyAdmin = (companyId: string, event: string, data: any) => {
    if (io) io.to(`company:${companyId}:admin`).emit(event, data);
};

export const emitToAgent = (userId: string, event: string, data: any) => {
    if (io) io.to(`user:${userId}`).emit(event, data);
};

export const emitToVisitor = (visitorToken: string, event: string, data: any) => {
    if (io && visitorToken) io.to(`visitor:${visitorToken}`).emit(event, data);
};

export const emitToConversation = (conversationId: string, event: string, data: any) => {
    if (io) io.to(conversationId).emit(event, data);
};

export const safeEmitConversationUpdate = (conversation: any, event: string, data: any) => {
    if (io) {
        const companyId = conversation.companyId;
        const assignedToId = conversation.assignedToId;

        const enrichedData = {
            ...data,
            conversationId: data.conversationId || conversation.id,
        };

        emitToCompanyAdmin(companyId, event, enrichedData);

        if (assignedToId) {
            emitToAgent(assignedToId, event, enrichedData);
        } else {
            emitToCompany(companyId, event, enrichedData);
        }
    }
};
