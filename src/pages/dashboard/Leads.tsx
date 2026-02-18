import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import LeadsTable from "../../components/leads/LeadsTable";
import SectionSummary from "../../components/dashboard/SectionSummary";
import { api } from "../../lib/api";

export default function Leads() {
  const { token, companyId, user } = useAuth();
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
      if (filter === "all" || filter === "unassigned") {
        setLeads((prev) => [lead, ...prev]);
      }
    };

    const onAssigned = (data: any) => {
      // data: { conversationId, assignedTo: {id, name}, status }
      setLeads((prev) => prev.map(lead => {
        if (lead.conversationId === data.conversationId) {
          // Determine if we should keep it in current filter view
          if (filter === "unassigned" && data.assignedTo) return null; // Remove from unassigned
          if (filter === "me" && data.assignedTo?.id !== user?.id) return null; // Verify filtering

          return {
            ...lead,
            agentAssigned: data.assignedTo?.name,
            assignedTo: data.assignedTo,
            status: data.status
          };
        }
        return lead;
      }).filter(Boolean) as any[]);
    };

    socket.on("lead_created", onNewLead);
    socket.on("conversation_assigned", onAssigned);

    return () => {
      socket.off("lead_created", onNewLead);
      socket.off("conversation_assigned", onAssigned);
    };
  }, [socket, filter, user]);

  const handleClaim = async (conversationId: string, e: any) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      await api.patch(`/conversations/${conversationId}/assign`, { assignedToId: user.id });
      // Optimistic UI update
      setLeads(prev => prev.map(l =>
        l.conversationId === conversationId
          ? { ...l, agentAssigned: user.name, assignedTo: { id: user.id, name: user.name } }
          : l
      ));
    } catch (err) {
      console.error("Failed to claim chat", err);
      alert("Could not claim chat. Someone else might have taken it.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SectionSummary
          title={filter === 'me' ? "My Inbox" : filter === 'unassigned' ? "Team Inbox" : "All Leads"}
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
          onClaim={handleClaim}
        />
      )}
    </motion.div>
  );
}
