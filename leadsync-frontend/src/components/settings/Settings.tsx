import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { PageTransition } from "@/components/ui/Animations";

// Fixed display-only webhook URL constant
const DISPLAY_WEBHOOK_URL = "https://your-api-domain.com/api/instagram/webhook";

import { SavedRepliesManager } from "@/components/conversations/SavedReplies";
import { AutomationManager } from "@/components/settings/AutomationManager";
import { AssignmentStrategyManager } from "@/components/settings/AssignmentStrategyManager";

// Newly created subcomponents
import { ProfileSection } from "./ProfileSection";
import { BusinessDetailsSection } from "./BusinessDetailsSection";
import { TelegramIntegration } from "./TelegramIntegration";
import { InstagramIntegration } from "./InstagramIntegration";
import { CompanyCodeSection } from "./CompanyCodeSection";
import { RBACSection } from "./RBACSection";
import { AuditLogsSection } from "./AuditLogsSection";

export default function Settings() {
  const { token, user, updateUser } = useAuth();
  
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [botToken, setBotToken] = useState("");
  const [botCommands, setBotCommands] = useState<any[]>([]);

  const [botBusinessType, setBotBusinessType] = useState("");

  // Business Details
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  // Instagram State
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [instagramPageId, setInstagramPageId] = useState("");
  const [igPageIdInput, setIgPageIdInput] = useState("");
  const [igTokenInput, setIgTokenInput] = useState("");
  const [igVerifyToken, setIgVerifyToken] = useState("");

  const [assignmentStrategy, setAssignmentStrategy] = useState<"MANUAL" | "ROUND_ROBIN" | "LOAD_BALANCED">("MANUAL");
  const [agentWorkloads, setAgentWorkloads] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  /* ===============================
     LOAD DATA
  =============================== */
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [statusData, configData] = await Promise.all([
          api.get("/integrations/status"),
          api.get("/dashboard/bot-config"),
        ]);

        // Status
        setTelegramConnected(statusData.telegram?.connected || false);
        setTelegramUsername(statusData.telegram?.username || null);
        setInstagramConnected(statusData.instagram?.connected || false);
        setInstagramPageId(statusData.instagram?.pageId || "");
        setIgVerifyToken(statusData.instagram?.verifyToken || "");

        // Config
        if (configData.company) {
          setBotBusinessType(configData.company.botBusinessType || "");
          setBusinessName(configData.company.businessName || "");
          setBusinessAddress(configData.company.businessAddress || "");
          setGstin(configData.company.gstin || "");
          setCompanyCode(configData.company.companyCode || "");
          setAssignmentStrategy(configData.company.assignmentStrategy || "MANUAL");
          setBotCommands(configData.company.botCommands || []);
        }
        if (configData.agentWorkloads) {
          setAgentWorkloads(configData.agentWorkloads);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  /* ===============================
     CONNECT TELEGRAM
  =============================== */
  const handleConnectTelegram = async () => {
    if (!botToken.trim()) {
      toast.error("Bot token required");
      return;
    }

    try {
      const data = await api.post("/integrations/telegram/connect", {
        token: botToken,
        businessType: botBusinessType || "general",
      });

      setTelegramConnected(true);
      setTelegramUsername(data.botUsername);
      setBotToken("");

      toast.success("Telegram connected 🚀");
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to connect");
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!window.confirm("Are you sure you want to disconnect Telegram?")) return;

    try {
      await api.post("/integrations/telegram/disconnect");
      setTelegramConnected(false);
      setTelegramUsername(null);
      toast.success("Telegram disconnected 👋");
    } catch (err: any) {
      toast.error("Failed to disconnect");
    }
  };

  const handleSaveCommands = async (updatedCommands: any[]) => {
    try {
      const response = await api.post("/integrations/telegram/commands", {
        commands: updatedCommands,
      });
      setBotCommands(response.commands);
      toast.success(response.message);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to sync commands");
    }
  };

  /* ===============================
     CONNECT INSTAGRAM
  =============================== */
  const handleConnectInstagram = async () => {
    if (!igPageIdInput.trim() || !igTokenInput.trim()) {
      toast.error("Page ID and Access Token required");
      return;
    }

    try {
      await api.post("/integrations/instagram/connect", {
        pageId: igPageIdInput,
        accessToken: igTokenInput,
      });

      setInstagramConnected(true);
      setInstagramPageId(igPageIdInput);
      setIgPageIdInput("");
      setIgTokenInput("");

      toast.success("Instagram connected 📸");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to connect Instagram");
    }
  };

  const handleDisconnectInstagram = async () => {
    if (!window.confirm("Are you sure you want to disconnect Instagram?")) return;

    try {
      await api.post("/integrations/instagram/disconnect");
      setInstagramConnected(false);
      setInstagramPageId("");
      toast.success("Instagram disconnected 👋");
    } catch (err: any) {
      toast.error("Failed to disconnect Instagram");
    }
  };

  const handleSaveBusinessDetails = async () => {
    try {
      await api.patch("/dashboard/business-details", {
        businessName,
        businessAddress,
        gstin,
      });
      toast.success("Business details saved ✅");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save business details");
    }
  };

  const handleSaveAssignmentStrategy = async (strategy: "MANUAL" | "ROUND_ROBIN" | "LOAD_BALANCED") => {
    try {
      await api.patch("/dashboard/assignment-strategy", {
        assignmentStrategy: strategy,
      });
      setAssignmentStrategy(strategy);
      
      // Re-fetch workloads to reflect latest real-time loads
      const configRes = await api.get("/dashboard/bot-config");
      if (configRes.agentWorkloads) {
        setAgentWorkloads(configRes.agentWorkloads);
      }
      toast.success("Routing strategy updated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update strategy");
    }
  };

  /* ===============================
     UI
  =============================== */

  if (isLoading) {
    return (
      <PageTransition className="space-y-8 max-w-4xl pb-12">
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-4 bg-slate-200 rounded w-80" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border bg-app-surface p-6 space-y-4 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-1/3" />
            <div className="h-10 bg-slate-100 rounded-xl w-full" />
            <div className="h-10 bg-slate-100 rounded-xl w-full" />
          </div>
        ))}
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8 max-w-4xl pb-12">

      {/* PROFILE */}
      <ProfileSection 
        user={user}
        updateUser={updateUser}
        setAgentWorkloads={setAgentWorkloads}
      />

      {/* SYSTEM CONFIDENTIAL - COMPANY CODE & RBAC */}
      {user?.role === "OWNER" && (
        <>
          <CompanyCodeSection companyCode={companyCode} />
          <RBACSection />
          <AuditLogsSection />
        </>
      )}

      {/* BUSINESS DETAILS (FOR INVOICING) */}
      <BusinessDetailsSection 
        businessName={businessName}
        setBusinessName={setBusinessName}
        businessAddress={businessAddress}
        setBusinessAddress={setBusinessAddress}
        gstin={gstin}
        setGstin={setGstin}
        handleSaveBusinessDetails={handleSaveBusinessDetails}
      />

      {/* SAVED REPLIES */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border border-app">
        <SavedRepliesManager />
      </div>

      {/* AUTOMATION RULES */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border border-app">
        <AutomationManager />
      </div>

      {/* AUTOMATED CHAT ASSIGNMENT STRATEGIES */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border border-app">
        <AssignmentStrategyManager
          currentStrategy={assignmentStrategy}
          workloads={agentWorkloads}
          isActive={true}
          onSave={handleSaveAssignmentStrategy}
        />
      </div>

      {/* TELEGRAM */}
      <TelegramIntegration 
        telegramConnected={telegramConnected}
        telegramUsername={telegramUsername}
        botToken={botToken}
        setBotToken={setBotToken}
        handleConnectTelegram={handleConnectTelegram}
        handleDisconnectTelegram={handleDisconnectTelegram}
        botCommands={botCommands}
        onSaveCommands={handleSaveCommands}
      />

      {/* INSTAGRAM */}
      <InstagramIntegration 
        instagramConnected={instagramConnected}
        instagramPageId={instagramPageId}
        igPageIdInput={igPageIdInput}
        setIgPageIdInput={setIgPageIdInput}
        igTokenInput={igTokenInput}
        setIgTokenInput={setIgTokenInput}
        igVerifyToken={igVerifyToken}
        DISPLAY_WEBHOOK_URL={DISPLAY_WEBHOOK_URL}
        handleConnectInstagram={handleConnectInstagram}
        handleDisconnectInstagram={handleDisconnectInstagram}
      />

    </PageTransition>
  );
}
