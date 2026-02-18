import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import LeadsTable from "../../components/leads/LeadsTable";
import SectionSummary from "../../components/dashboard/SectionSummary";
import { api } from "../../lib/api"; // ✅ centralized API

export default function Leads() {
  const { token, companyId } = useAuth();
  const navigate = useNavigate();

  // Simple persist cache
  const [leads, setLeads] = useState<any[]>(() => {
    if (!companyId) return [];
    const saved = localStorage.getItem(`leadsync_leads_cache_${companyId}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [loading, setLoading] = useState(leads.length === 0);

  const { socket } = useSocket();

  useEffect(() => {
    if (!token) return;

    const fetchLeads = async () => {
      try {
        setLoading(true);
        const data = await api.get("/leads");
        setLeads(data);
        if (companyId) {
          localStorage.setItem(`leadsync_leads_cache_${companyId}`, JSON.stringify(data));
        }
      } catch (err) {
        console.error("❌ Failed to fetch leads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [token]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const onNewLead = (lead: any) => {
      setLeads((prev) => [lead, ...prev]);
    };

    socket.on("lead_created", onNewLead);

    return () => {
      socket.off("lead_created", onNewLead);
    };
  }, [socket]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <SectionSummary
        title="Leads"
        description="All prospects from Telegram and other integrated channels."
        stats={[
          { label: "Total", value: String(leads.length) },
          { label: "Active", value: String(leads.length) },
        ]}
      />

      {loading ? (
        <div className="p-6 text-slate-400">Loading leads...</div>
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
