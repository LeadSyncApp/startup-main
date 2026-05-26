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

        // Derive socket base URL from dynamically available host or Vite config variable
        const API_BASE = (typeof window !== 'undefined' ? window.location.origin : import.meta.env.VITE_API_URL?.replace("/api", "")) || "http://localhost:4000";

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
            if (user.id) {
                newSocket.emit("join_user", user.id);
            }
            // Admins & Owners join the admin room to receive assigned-conversation updates
            if (user.role === "OWNER" || user.role === "ADMIN") {
                newSocket.emit("join_admin", user.companyId);
            }
        });

        newSocket.on("disconnect", () => {
            console.log("🔴 Socket disconnected");
            setConnected(false);
        });

        // Global listener for agent inbox notes to keep active chats updated
        newSocket.on("agent_inbox_new_note", (newNote: any) => {
            let otherAgentId = null;
            if (newNote.authorId === user.id) {
                otherAgentId = newNote.mentionedIds?.find((id: string) => id !== user.id);
            } else {
                otherAgentId = newNote.authorId;
            }
            if (otherAgentId) {
                try {
                    const saved = localStorage.getItem("agent_active_chats");
                    const activeChats = saved ? JSON.parse(saved) : [];
                    if (!activeChats.includes(otherAgentId)) {
                        localStorage.setItem("agent_active_chats", JSON.stringify([otherAgentId, ...activeChats]));
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }
        });

        // Global listener for cleared chats
        newSocket.on("agent_chat_cleared", (data: any) => {
            if (data.by) {
                try {
                    const saved = localStorage.getItem("agent_active_chats");
                    let activeChats = saved ? JSON.parse(saved) : [];
                    activeChats = activeChats.filter((id: string) => id !== data.by);
                    localStorage.setItem("agent_active_chats", JSON.stringify(activeChats));
                } catch (e) {
                    // Ignore
                }
                
                // Dispatch custom window event so AgentInbox can clear its notes array and UI immediately
                window.dispatchEvent(new CustomEvent('agentChatClearedEvent', { detail: { targetId: data.by } }));
            }
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
