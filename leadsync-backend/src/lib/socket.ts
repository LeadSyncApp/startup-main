import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { prisma } from "./prisma";

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PATCH", "DELETE"]
        }
    });

    io.on("connection", async (socket) => {
        console.log(`🔌 New socket connection: ${socket.id}`);

        // SECURITY: We expect a token relative to the user to identify them
        // But for now, we rely on client-side "join_company" with token validation if implemented.
        // Assuming the client sends the userId in handshake or just joins based on logic below.

        socket.on("join_company", (companyId: string) => {
            // Everyone joins the company room (for system-wide announcements if needed)
            // But we should be careful what we emit here.
            socket.join(companyId);
            console.log(`🏢 Socket ${socket.id} joined company: ${companyId}`);
        });

        // ✅ NEW: Join specific user room
        socket.on("join_user", (userId: string) => {
            socket.join(`user:${userId}`);
            console.log(`👤 Socket ${socket.id} joined user room: user:${userId}`);
        });

        socket.on("join_conversation", (conversationId: string) => {
            socket.join(conversationId);
            console.log(`💬 Socket ${socket.id} joined conversation: ${conversationId}`);
        });

        // Typing indicators — relay to others in the same conversation room
        socket.on("typing_start", ({ conversationId, agentName }: { conversationId: string; agentName: string }) => {
            socket.to(conversationId).emit("agent_typing", { conversationId, agentName });
        });

        socket.on("typing_stop", ({ conversationId }: { conversationId: string }) => {
            socket.to(conversationId).emit("agent_typing_stop", { conversationId });
        });

        socket.on("leave_conversation", (conversationId: string) => {
            socket.leave(conversationId);
        });

        // ✅ NEW: Join admin room
        socket.on("join_admin", (companyId: string) => {
            socket.join(`company:${companyId}:admin`);
            console.log(`🛡️ Socket ${socket.id} joined admin room: company:${companyId}:admin`);
        });

        socket.on("disconnect", () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => io;

// 🚨 DEPRECATED: Use safeEmitConversationUpdate instead
export const emitToCompany = (companyId: string, event: string, data: any) => {
    if (io) io.to(companyId).emit(event, data);
};

// ✅ Emit to Company Admins Only
export const emitToCompanyAdmin = (companyId: string, event: string, data: any) => {
    if (io) io.to(`company:${companyId}:admin`).emit(event, data);
};

// ✅ Emit to Specific Agent
export const emitToAgent = (userId: string, event: string, data: any) => {
    if (io) io.to(`user:${userId}`).emit(event, data);
};

// ✅ HELPER: Emit to conversation (legacy/debugging)
export const emitToConversation = (conversationId: string, event: string, data: any) => {
    if (io) io.to(conversationId).emit(event, data);
};

/**
 * 🔒 PRIVACY-AWARE EMITTER
 * Intelligent routing of events based on conversation state.
 * 
 * Rules:
 * - Unclaimed: Emit to EVERYONE in company (so they can claim it)
 * - Assigned: Emit ONLY to Assigned Agent + Admins
 */
export const safeEmitConversationUpdate = (conversation: any, event: string, data: any) => {
    if (!io) return;

    const companyId = conversation.companyId;
    const assignedToId = conversation.assignedToId;

    // 1. Always notify Admins
    emitToCompanyAdmin(companyId, event, data);

    // 2. Routing Logic
    if (assignedToId) {
        // 🔒 PRIVATE: Only the assigned agent sees this
        emitToAgent(assignedToId, event, data);
    } else {
        // 🔓 PUBLIC: Unclaimed, so all agents in company valid to see it
        emitToCompany(companyId, event, data);
    }
};
