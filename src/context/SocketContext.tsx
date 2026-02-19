import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    connected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!token || !user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setConnected(false);
            }
            return;
        }

        const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "https://startup-production-77de.up.railway.app";

        const newSocket = io(API_BASE, {
            auth: { token },
            transports: ["websocket", "polling"], // Prefer WebSocket
            reconnection: true,             // Enable auto-reconnect
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
        });

        newSocket.on("connect", () => {
            console.log("🟢 Socket connected:", newSocket.id);
            setConnected(true);

            if (user.companyId) {
                newSocket.emit("join_company", user.companyId);
            }
        });

        newSocket.on("disconnect", () => {
            console.log("🔴 Socket disconnected");
            setConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token, user?.companyId]);

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};
