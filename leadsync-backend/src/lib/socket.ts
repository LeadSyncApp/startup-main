import { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PATCH", "DELETE"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log(`🔌 New socket connection: ${socket.id}`);

        socket.on("join_company", (companyId: string) => {
            socket.join(companyId);
            console.log(`🏢 Socket ${socket.id} joined company: ${companyId}`);
        });

        socket.on("join_conversation", (conversationId: string) => {
            socket.join(conversationId);
            console.log(`💬 Socket ${socket.id} joined conversation: ${conversationId}`);
        });

        socket.on("disconnect", () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

// HELPER: Emit to company
export const emitToCompany = (companyId: string, event: string, data: any) => {
    if (io) {
        io.to(companyId).emit(event, data);
    }
};

// HELPER: Emit to conversation
export const emitToConversation = (conversationId: string, event: string, data: any) => {
    if (io) {
        io.to(conversationId).emit(event, data);
    }
};
