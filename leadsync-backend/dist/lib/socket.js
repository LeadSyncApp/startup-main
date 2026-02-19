"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeEmitConversationUpdate = exports.emitToConversation = exports.emitToAgent = exports.emitToCompanyAdmin = exports.emitToCompany = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io = null;
const initSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
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
        socket.on("join_company", (companyId) => {
            // Everyone joins the company room (for system-wide announcements if needed)
            // But we should be careful what we emit here.
            socket.join(companyId);
            console.log(`🏢 Socket ${socket.id} joined company: ${companyId}`);
        });
        // ✅ NEW: Join specific user room
        socket.on("join_user", (userId) => {
            socket.join(`user:${userId}`);
            console.log(`👤 Socket ${socket.id} joined user room: user:${userId}`);
        });
        // ✅ NEW: Join admin room
        socket.on("join_admin", (companyId) => {
            socket.join(`company:${companyId}:admin`);
            console.log(`🛡️ Socket ${socket.id} joined admin room: company:${companyId}:admin`);
        });
        socket.on("disconnect", () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => io;
exports.getIO = getIO;
// 🚨 DEPRECATED: Use safeEmitConversationUpdate instead
const emitToCompany = (companyId, event, data) => {
    if (io)
        io.to(companyId).emit(event, data);
};
exports.emitToCompany = emitToCompany;
// ✅ Emit to Company Admins Only
const emitToCompanyAdmin = (companyId, event, data) => {
    if (io)
        io.to(`company:${companyId}:admin`).emit(event, data);
};
exports.emitToCompanyAdmin = emitToCompanyAdmin;
// ✅ Emit to Specific Agent
const emitToAgent = (userId, event, data) => {
    if (io)
        io.to(`user:${userId}`).emit(event, data);
};
exports.emitToAgent = emitToAgent;
// ✅ HELPER: Emit to conversation (legacy/debugging)
const emitToConversation = (conversationId, event, data) => {
    if (io)
        io.to(conversationId).emit(event, data);
};
exports.emitToConversation = emitToConversation;
/**
 * 🔒 PRIVACY-AWARE EMITTER
 * Intelligent routing of events based on conversation state.
 *
 * Rules:
 * - Unclaimed: Emit to EVERYONE in company (so they can claim it)
 * - Assigned: Emit ONLY to Assigned Agent + Admins
 */
const safeEmitConversationUpdate = (conversation, event, data) => {
    if (!io)
        return;
    const companyId = conversation.companyId;
    const assignedToId = conversation.assignedToId;
    // 1. Always notify Admins
    (0, exports.emitToCompanyAdmin)(companyId, event, data);
    // 2. Routing Logic
    if (assignedToId) {
        // 🔒 PRIVATE: Only the assigned agent sees this
        (0, exports.emitToAgent)(assignedToId, event, data);
    }
    else {
        // 🔓 PUBLIC: Unclaimed, so all agents in company valid to see it
        (0, exports.emitToCompany)(companyId, event, data);
    }
};
exports.safeEmitConversationUpdate = safeEmitConversationUpdate;
