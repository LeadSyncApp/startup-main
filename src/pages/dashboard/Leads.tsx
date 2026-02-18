import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import LeadsTable from "../../components/leads/LeadsTable";
import SectionSummary from "../../components/dashboard/SectionSummary";
import { api } from "../../lib/api";

export default function Leads() {
  const { token, companyId } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();

  // Filter State for Shared Inbox
  const [filter, setFilter] = useState("all"); // 'all', 'me', 'unassigned'

  // Leads State
  const [leads, setLeads] = useState<any[]>(() => {
    // Only hydrate from cache if default 'all' view
    if (!companyId) return [];
    try {
      const saved = localStorage.getItem(`leadsync_leads_cache_${companyId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [loading, setLoading] = useState(leads.length === 0);

  useEffect(() => {
    if (!token) return;

    const fetchLeads = async () => {
      try {
        setLoading(true);
        const data = await api.get(`/leads?filter=${filter}`);
        setLeads(data);
        if (companyId && filter === "all") {
          localStorage.setItem(`leadsync_leads_cache_${companyId}`, JSON.stringify(data));
        }
      } catch (err) {
        console.error("❌ Failed to fetch leads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [token, filter]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const onNewLead = (lead: any) => {
      // If viewing "My Chats", we only add if assigned to me (handled by complex logic or just refresh)
      // For simplicity, we append to "all" and "unassigned" lists for now (assuming new leads are unassigned)
      if (filter === "all" || filter === "unassigned") {
        setLeads((prev) => [lead, ...prev]);
      }
    };

    socket.on("lead_created", onNewLead);

    // Logic: If I am assigned a conversation, I should technically refresh or receive a specific event.
    // For now, we rely on manual navigation or refresh for assignments.

    return () => {
      socket.off("lead_created", onNewLead);
    };
  }, [socket, filter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SectionSummary
          title={filter === 'me' ? "My Inbox" : filter === 'unassigned' ? "Unassigned Team Inbox" : "All Leads"}
          description="Manage customer sales and support tickets."
          stats={[
            { label: "Visible", value: String(leads.length) },
          ]}
        />

        {/* Inbox Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg self-start">
          {["all", "me", "unassigned"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${filter === f
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                }`}
            >
              {f === "all" ? "All" : f === "me" ? "Mine" : "Unassigned"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-slate-400">Loading inbox...</div>
      ) : (
        <LeadsTable
          leads={leads}
          onRowClick={(lead: any) => {
            if (lead.conversationId) {
              navigate(
                `/dashboard/conversations?conversationId=${lead.conversationId}`
              );
            }
          }}
        />
      )}
    </motion.div>
  );
}
