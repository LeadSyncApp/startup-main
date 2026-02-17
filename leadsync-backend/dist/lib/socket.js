"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToConversation = exports.emitToCompany = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io = null;
const initSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PATCH", "DELETE"],
            credentials: true
        }
    });
    io.on("connection", (socket) => {
        console.log(`🔌 New socket connection: ${socket.id}`);
        socket.on("join_company", (companyId) => {
            socket.join(companyId);
            console.log(`🏢 Socket ${socket.id} joined company: ${companyId}`);
        });
        socket.on("join_conversation", (conversationId) => {
            socket.join(conversationId);
            console.log(`💬 Socket ${socket.id} joined conversation: ${conversationId}`);
        });
        socket.on("disconnect", () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
exports.getIO = getIO;
// HELPER: Emit to company
const emitToCompany = (companyId, event, data) => {
    if (io) {
        io.to(companyId).emit(event, data);
    }
};
exports.emitToCompany = emitToCompany;
// HELPER: Emit to conversation
const emitToConversation = (conversationId, event, data) => {
    if (io) {
        io.to(conversationId).emit(event, data);
    }
};
exports.emitToConversation = emitToConversation;
