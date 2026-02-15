import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LeadsTable from "../../components/leads/LeadsTable";
import SectionSummary from "../../components/dashboard/SectionSummary";
import { api } from "../../lib/api"; // ✅ centralized API

export default function Leads() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchLeads = async () => {
      try {
        const data = await api.get("/leads");
        setLeads(data);
      } catch (err) {
        console.error("❌ Failed to fetch leads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [token]);

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
