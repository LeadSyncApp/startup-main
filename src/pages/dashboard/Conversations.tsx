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

interface OrderPreview {
  id: string;
  summary: string;
  amount: number;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
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
  const [pendingOrder, setPendingOrder] = useState<OrderPreview | null>(null);
  const [newMessage, setNewMessage] = useState("");

  /* LOAD CONVERSATIONS */
  useEffect(() => {
    if (!token) return;
    loadConversations();
  }, [token]);

  const loadConversations = async () => {
    const data = await api.get("/conversations");
    setConversations(data);
  };

  /* FETCH MESSAGES */
  const fetchMessages = async (conv: Conversation) => {
    const data = await api.get(`/conversations/${conv.id}/messages`);

    setMessages(data.messages);
    setSelected({ ...conv, mode: data.mode });

    // 🔥 Check for pending orders for this conversation
    const orders = await api.get(`/orders`);
    const found = orders.find(
      (o: any) =>
        o.conversationId === conv.id &&
        o.approvalStatus === "PENDING"
    );

    setPendingOrder(found || null);
  };

  /* AUTO REFRESH */
  useEffect(() => {
    if (!selected) return;

    const interval = setInterval(() => {
      fetchMessages(selected);
      loadConversations();
    }, 3000);

    return () => clearInterval(interval);
  }, [selected]);

  /* SEND MESSAGE (OPTIMISTIC UI) */
  const sendMessage = async () => {
    if (!newMessage.trim() || !selected) return;

    const tempId = `temp-${Date.now()}`;
    const content = newMessage;

    // 1. Optimistic Update
    const optimisticMessage: Message = {
      id: tempId,
      content,
      sender: "AGENT",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      // 2. Network Request
      await api.post(`/conversations/${selected.id}/send`, {
        content,
      });

      // 3. Sync Real Data (Quietly)
      fetchMessages(selected);
    } catch (err) {
      // 4. Rollback on Error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error("Failed to send message", err);
    }
  };

  /* TOGGLE MODE */
  const toggleMode = async (mode: "BOT" | "HUMAN") => {
    if (!selected) return;

    await api.patch(`/conversations/${selected.id}/mode`, { mode });
    fetchMessages(selected);
  };

  return (
    <div className="flex h-[80vh] bg-white border rounded-2xl overflow-hidden shadow-lg">

      {/* LEFT PANEL */}
      <div className="w-1/3 border-r bg-slate-50 overflow-y-auto">
        <div className="p-4 font-semibold border-b text-slate-700">
          Conversations
        </div>

        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => fetchMessages(conv)}
            className={`p-4 border-b cursor-pointer transition ${selected?.id === conv.id
                ? "bg-indigo-100"
                : "hover:bg-slate-100"
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
            <div className="p-4 border-b flex justify-between items-center bg-white">
              <div>
                <p className="font-semibold text-slate-800">
                  {selected.lead?.name || "Customer"}
                </p>
                <p className="text-xs text-slate-500">
                  {selected.lead?.contact}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggleMode("BOT")}
                  className={`px-3 py-1 text-xs rounded-full ${selected.mode === "BOT"
                      ? "bg-green-600 text-white"
                      : "bg-green-100 text-green-800"
                    }`}
                >
                  BOT
                </button>

                <button
                  onClick={() => toggleMode("HUMAN")}
                  className={`px-3 py-1 text-xs rounded-full ${selected.mode === "HUMAN"
                      ? "bg-red-600 text-white"
                      : "bg-red-100 text-red-800"
                    }`}
                >
                  HUMAN
                </button>
              </div>
            </div>

            {/* 🔥 PENDING ORDER BANNER */}
            {pendingOrder && (
              <div className="bg-yellow-50 border-b border-yellow-200 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">
                      ⏳ Pending Order Detected
                    </p>
                    <p className="text-xs text-yellow-700">
                      {pendingOrder.summary} — ₹
                      {pendingOrder.amount.toFixed(2)}
                    </p>
                  </div>

                  <a
                    href="/orders"
                    className="text-xs bg-yellow-600 text-white px-3 py-1 rounded-full"
                  >
                    Open Orders
                  </a>
                </div>
              </div>
            )}

            {/* MESSAGES */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-xs p-3 rounded-2xl text-sm shadow-sm ${msg.sender === "CLIENT"
                      ? "bg-white border"
                      : msg.sender === "SYSTEM"
                        ? "bg-purple-100 text-purple-800 mx-auto"
                        : "bg-indigo-600 text-white ml-auto"
                    }`}
                >
                  {msg.content}
                </motion.div>
              ))}
            </div>

            {/* INPUT */}
            <div className="p-4 border-t flex gap-2 bg-white">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                placeholder="Type your reply..."
              />
              <button
                onClick={sendMessage}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm"
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
