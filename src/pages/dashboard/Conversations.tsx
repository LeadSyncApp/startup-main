import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";
import { api } from "../../lib/api";

interface Message {
  id: string;
  content: string;
  sender: "CLIENT" | "AGENT" | "SYSTEM";
  createdAt: string;
}

interface Conversation {
  id: string;
  mode: "BOT" | "HUMAN";
  lead: {
    name: string | null;
    contact: string;
  };
  lastMessage: string;
}

export default function Conversations() {
  const { token } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  /* ---------------- LOAD CONVERSATIONS ---------------- */
  useEffect(() => {
    if (!token) return;
    loadConversations();
  }, [token]);

  const loadConversations = async () => {
    try {
      const data = await api.get("/conversations");
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  /* ---------------- FETCH MESSAGES ---------------- */
  const fetchMessages = async (conv: Conversation) => {
    try {
      const data = await api.get(`/conversations/${conv.id}/messages`);
      setMessages(data.messages);

      // Always trust backend mode
      setSelected({
        ...conv,
        mode: data.mode,
      });
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  /* ---------------- AUTO REFRESH (VERY IMPORTANT) ---------------- */
  useEffect(() => {
    if (!selected) return;

    const interval = setInterval(() => {
      fetchMessages(selected);
      loadConversations();
    }, 3000); // 3 seconds

    return () => clearInterval(interval);
  }, [selected]);

  /* ---------------- SEND MESSAGE ---------------- */
  const sendMessage = async () => {
    if (!newMessage.trim() || !selected) return;

    try {
      await api.post(`/conversations/${selected.id}/send`, {
        content: newMessage,
      });

      setNewMessage("");

      await fetchMessages(selected);
      await loadConversations();
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  /* ---------------- TOGGLE MODE ---------------- */
  const toggleMode = async (mode: "BOT" | "HUMAN") => {
    if (!selected) return;

    try {
      await api.patch(`/conversations/${selected.id}/mode`, { mode });

      // Immediately refetch from backend to avoid race condition
      await fetchMessages(selected);
      await loadConversations();

      console.log("Mode switched to:", mode);
    } catch (err) {
      console.error("Mode update failed:", err);
    }
  };

  return (
    <div className="flex h-[80vh] bg-white border rounded-xl overflow-hidden">

      {/* LEFT PANEL */}
      <div className="w-1/3 border-r bg-slate-50 overflow-y-auto">
        <div className="p-4 font-semibold border-b">
          Conversations
        </div>

        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => fetchMessages(conv)}
            className={`p-4 border-b cursor-pointer hover:bg-slate-100 ${
              selected?.id === conv.id ? "bg-slate-200" : ""
            }`}
          >
            <p className="font-medium">
              {conv.lead?.name || "Customer"}
            </p>
            <p className="text-xs text-slate-500">
              {conv.lead?.contact}
            </p>
            <p className="text-xs text-slate-400">
              Mode: {conv.mode}
            </p>
          </div>
        ))}
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            Select a conversation
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <p className="font-semibold">
                  {selected.lead?.name || "Customer"}
                </p>
                <p className="text-xs text-slate-500">
                  {selected.lead?.contact}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggleMode("BOT")}
                  className={`px-3 py-1 rounded ${
                    selected.mode === "BOT"
                      ? "bg-green-600 text-white"
                      : "bg-green-200 text-green-800"
                  }`}
                >
                  BOT
                </button>

                <button
                  onClick={() => toggleMode("HUMAN")}
                  className={`px-3 py-1 rounded ${
                    selected.mode === "HUMAN"
                      ? "bg-red-600 text-white"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  HUMAN
                </button>
              </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-xs p-3 rounded-lg text-sm ${
                    msg.sender === "CLIENT"
                      ? "bg-white border"
                      : "bg-blue-600 text-white ml-auto"
                  }`}
                >
                  {msg.content}
                </motion.div>
              ))}
            </div>

            {/* INPUT */}
            <div className="p-4 border-t flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 border rounded px-3 py-2"
                placeholder="Type your reply..."
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
