import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { PageTransition } from "../../components/ui/Animations";

// Fixed display-only webhook URL constant
const DISPLAY_WEBHOOK_URL = "https://your-api-domain.com/api/instagram/webhook";
import { SavedRepliesManager } from "../../components/conversations/SavedReplies";
import { BotKnowledgeManager } from "../../components/settings/BotKnowledgeManager";
import { AutomationManager } from "../../components/settings/AutomationManager";
import { AssignmentStrategyManager } from "../../components/settings/AssignmentStrategyManager";

interface MenuItem {
  name: string;
  price: number;
}

interface Category {
  name: string;
  items: MenuItem[];
}

interface StructuredMenu {
  categories: Category[];
}


export default function Settings() {
  const { token, user, updateUser } = useAuth();
  // ... existing states ...
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [botToken, setBotToken] = useState("");

  const [botBusinessType, setBotBusinessType] = useState("");
  const [botWelcomeMessage, setBotWelcomeMessage] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [botKnowledgeBase, setBotKnowledgeBase] = useState("");
  const [botLearnedContext, setBotLearnedContext] = useState("");
  const [botPolicies, setBotPolicies] = useState("");
  const [isTraining, setIsTraining] = useState(false);

  // Business Details
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [gstin, setGstin] = useState("");

  // Instagram State
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [instagramPageId, setInstagramPageId] = useState("");
  const [igPageIdInput, setIgPageIdInput] = useState("");
  const [igTokenInput, setIgTokenInput] = useState("");
  const [igVerifyToken, setIgVerifyToken] = useState("");

  const [onboardingMode, setOnboardingMode] = useState<'PASTE' | 'MANUAL' | 'FILE'>('PASTE');
  const [previewMenu, setPreviewMenu] = useState<StructuredMenu | null>(null);
  const [mergeWithExisting, setMergeWithExisting] = useState(true);
  const [generatedMenu, setGeneratedMenu] = useState<StructuredMenu | null>(null);

  const [assignmentStrategy, setAssignmentStrategy] = useState<"MANUAL" | "ROUND_ROBIN" | "LOAD_BALANCED">("MANUAL");
  const [agentWorkloads, setAgentWorkloads] = useState<any[]>([]);


  const [isGenerating, setIsGenerating] = useState(false);
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
          setBotWelcomeMessage(configData.company.botWelcomeMessage || "");
          setGeneratedMenu(configData.company.botStructuredMenu || null);
          setBotKnowledgeBase(configData.company.botKnowledgeBase || "");
          setBotLearnedContext(configData.company.botLearnedContext || "");
          setBotPolicies(configData.company.botPolicies || "");
          setBusinessName(configData.company.businessName || "");
          setBusinessAddress(configData.company.businessAddress || "");
          setGstin(configData.company.gstin || "");
          setAssignmentStrategy(configData.company.assignmentStrategy || "MANUAL");
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

  /* ===============================
     COMMERCE AI ONBOARDING (PHASE 2A)
  =============================== */
  // Helper: Convert a StructuredMenu into a human-readable text block for AI Knowledge Base
  const menuToKnowledgeText = (menu: StructuredMenu): string => {
    return menu.categories
      .map((cat) => {
        const items = cat.items
          .map((item) => `  - ${item.name}: ₹${item.price}`)
          .join("\n");
        return `${cat.name}:\n${items}`;
      })
      .join("\n\n");
  };

  // Helper: Merge two StructuredMenus by category name (frontend merge)
  const mergeMenus = (existing: StructuredMenu, incoming: StructuredMenu): StructuredMenu => {
    const merged = { categories: existing.categories.map((c) => ({ ...c, items: [...c.items] })) };
    for (const incomingCat of incoming.categories) {
      const existingCat = merged.categories.find(
        (c) => c.name.toLowerCase() === incomingCat.name.toLowerCase()
      );
      if (existingCat) {
        for (const incomingItem of incomingCat.items) {
          const alreadyExists = existingCat.items.find(
            (i) => i.name.toLowerCase() === incomingItem.name.toLowerCase()
          );
          if (!alreadyExists) {
            existingCat.items.push(incomingItem);
          }
        }
      } else {
        merged.categories.push({ ...incomingCat, items: [...incomingCat.items] });
      }
    }
    return merged;
  };

  const handleAnalyzeSmartPaste = async () => {
    if (!shopDescription.trim()) return;

    setIsGenerating(true);
    const toastId = toast.loading("AI is normalizing your products...");

    try {
      const data = await api.post("/dashboard/analyze-menu", {
        rawText: shopDescription,
        mergeWithExisting: false // We handle merging on frontend
      });

      setPreviewMenu(data.menu);
      toast.success("Extraction complete! Review the preview below.", { id: toastId });
    } catch (err) {
      toast.error("Normalization failed. Please try a different format.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmPreview = async () => {
    if (!previewMenu) return;

    try {
      // Merge incoming items with existing menu on the frontend
      const finalMenu = mergeWithExisting && generatedMenu
        ? mergeMenus(generatedMenu, previewMenu)
        : previewMenu;

      // Auto-populate AI Knowledge Base with the formatted menu
      const menuText = menuToKnowledgeText(finalMenu);
      const newKnowledge = botKnowledgeBase
        ? botKnowledgeBase + "\n\n" + menuText
        : menuText;

      await api.patch("/dashboard/save-edited-menu", {
        structuredMenu: finalMenu,
        botBusinessType,
        botWelcomeMessage,
        botKnowledgeBase: newKnowledge,
      });

      setGeneratedMenu(finalMenu);
      setBotKnowledgeBase(newKnowledge);
      setPreviewMenu(null);
      setShopDescription("");

      toast.success("Products added! AI Knowledge Base updated — click Train AI to finalize. ✅");
    } catch {
      toast.error("Failed to commit menu changes.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading(`Uploading and analyzing ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mergeWithExisting", "false"); // We handle merging on frontend

      const response = await api.post("/dashboard/upload-menu-file", formData);

      setPreviewMenu(response.menu);
      toast.success("File processed! Review the extracted items below.", { id: toastId });
    } catch (err: any) {
      console.error("File upload error:", err);
      toast.error(err.response?.data?.message || "Failed to process file", { id: toastId });
    } finally {
      // Reset input
      e.target.value = "";
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent = "Category,Name,Price\nCoffee,Cold Brew Coffee,250\nCoffee,Oat Milk Latte,300\nBakery,Cheddar Croissant,180";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "menu_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ===============================
     MENU EDIT FUNCTIONS
  =============================== */

  const updateCategoryName = (index: number, name: string) => {
    if (!generatedMenu) return;

    const updated = { ...generatedMenu };
    updated.categories[index].name = name;
    setGeneratedMenu(updated);
  };

  const updateItem = (
    catIndex: number,
    itemIndex: number,
    field: "name" | "price",
    value: string
  ) => {
    if (!generatedMenu) return;

    const updated = { ...generatedMenu };

    if (field === "price") {
      updated.categories[catIndex].items[itemIndex].price =
        Number(value);
    } else {
      updated.categories[catIndex].items[itemIndex].name = value;
    }

    setGeneratedMenu(updated);
  };

  const addCategory = () => {
    if (!generatedMenu) return;

    const updated = { ...generatedMenu };
    updated.categories.push({
      name: "New Category",
      items: [],
    });

    setGeneratedMenu(updated);
  };

  const addItem = (catIndex: number) => {
    if (!generatedMenu) return;

    const updated = { ...generatedMenu };
    updated.categories[catIndex].items.push({
      name: "New Item",
      price: 0,
    });

    setGeneratedMenu(updated);
  };

  const deleteCategory = (index: number) => {
    if (!generatedMenu) return;

    const updated = { ...generatedMenu };
    updated.categories.splice(index, 1);
    setGeneratedMenu(updated);
  };

  const deleteItem = (catIndex: number, itemIndex: number) => {
    if (!generatedMenu) return;

    const updated = { ...generatedMenu };
    updated.categories[catIndex].items.splice(itemIndex, 1);
    setGeneratedMenu(updated);
  };

  const saveEditedMenu = async () => {
    try {
      // Also sync the AI Knowledge Base text with the current menu
      const menuText = generatedMenu ? menuToKnowledgeText(generatedMenu) : "";
      const syncedKnowledge = menuText
        ? (botKnowledgeBase && !botKnowledgeBase.includes(menuText)
            ? botKnowledgeBase + "\n\n" + menuText
            : botKnowledgeBase || menuText)
        : botKnowledgeBase;

      await api.patch("/dashboard/save-edited-menu", {
        structuredMenu: generatedMenu,
        botBusinessType,
        botWelcomeMessage,
        botKnowledgeBase: syncedKnowledge,
      });

      if (syncedKnowledge !== botKnowledgeBase) {
        setBotKnowledgeBase(syncedKnowledge);
      }
      toast.success("Menu saved successfully ✅");
    } catch {
      toast.error("Failed to save menu");
    }
  };

  /* ===============================
     KNOWLEDGE BASE FUNCTIONS
  =============================== */
  const handleTrainAI = async () => {
    if (!botKnowledgeBase.trim()) {
      toast.error("Enter items and descriptions first");
      return;
    }

    setIsTraining(true);
    const toastId = toast.loading("AI is learning your shop details...");

    try {
      const data = await api.post("/dashboard/train-ai", {
        botKnowledgeBase,
      });

      setBotLearnedContext(data.botLearnedContext);
      toast.success("AI Training complete! 🧠", { id: toastId });
    } catch (err) {
      toast.error("Training failed", { id: toastId });
    } finally {
      setIsTraining(false);
    }
  };

  const handleSaveKnowledge = async () => {
    try {
      await api.patch("/dashboard/save-knowledge", {
        botKnowledgeBase,
        botLearnedContext,
        botPolicies,
      });
      toast.success("Knowledge saved manually ✅");
    } catch {
      toast.error("Failed to save knowledge");
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
    } catch {
      toast.error("Failed to save business details");
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
          <div className="h-8 bg-app-bg-soft rounded w-48" />
          <div className="h-4 bg-app-bg-soft rounded w-80" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border bg-app-surface p-6 space-y-4 animate-pulse">
            <div className="h-5 bg-app-bg-soft rounded w-1/3" />
            <div className="h-10 bg-app-bg-soft rounded-xl w-full" />
            <div className="h-10 bg-app-bg-soft rounded-xl w-full" />
          </div>
        ))}
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8 max-w-4xl pb-12">

      {/* PROFILE */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Profile</h2>
          <div className="space-y-1 text-sm text-app-muted">
            <p><strong>Name:</strong> {user?.name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Role:</strong> <span className="bg-app-bg-soft text-app-text text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">{user?.role}</span></p>
          </div>
        </div>

        {/* Individual Availability Toggle */}
        <div className="border-t md:border-t-0 md:border-l border-app pt-4 md:pt-0 md:pl-6 flex flex-col justify-center min-w-[280px]">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
            Auto-Assignment Availability
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (!user) return;
                const newAvailableState = !(user.isAvailable !== false);
                try {
                  await api.patch(`/users/${user.id}/availability`, {
                    isAvailable: newAvailableState,
                  });
                  updateUser({ isAvailable: newAvailableState });
                  
                  // Re-fetch workloads to update crew workloads widget in real-time
                  const configRes = await api.get("/dashboard/bot-config");
                  if (configRes.agentWorkloads) {
                    setAgentWorkloads(configRes.agentWorkloads);
                  }

                  toast.success(newAvailableState 
                    ? "You are now accepting auto-assigned chats! 🟢" 
                    : "You paused receiving auto-assigned chats. 🟡"
                  );
                } catch (err) {
                  toast.error("Failed to update availability status");
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                user?.isAvailable !== false ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-app-surface shadow ring-0 transition duration-200 ease-in-out ${
                  user?.isAvailable !== false ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <div>
              <span className={`text-sm font-bold ${user?.isAvailable !== false ? "text-emerald-600" : "text-amber-500"}`}>
                {user?.isAvailable !== false ? "Accepting Chats" : "On Break / Paused"}
              </span>
              <p className="text-slate-400 text-[10px] leading-tight">
                {user?.isAvailable !== false ? "Active in Round-Robin and Load-Balancer." : "No new chats will auto-assign to you."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BUSINESS DETAILS (FOR INVOICING) */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🏢</span> Business Details (for Invoices)
        </h2>
        <p className="text-sm text-app-muted">
          These details will appear on the invoices generated for your customers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Legal Business Name</label>
            <input
              type="text"
              placeholder="Ex: Green Earth Cafe"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">GSTIN (Optional)</label>
            <input
              type="text"
              placeholder="Ex: 29AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registered Address</label>
            <textarea
              placeholder="Full address for invoice header..."
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none h-20"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveBusinessDetails}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm font-bold"
          >
            Save Business Details
          </button>
        </div>
      </div>

      {/* SAVED REPLIES */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border border-app">
        <SavedRepliesManager />
      </div>

      {/* BOT KNOWLEDGE */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border border-app">
        <BotKnowledgeManager />
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
      <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold">
          Telegram Integration
        </h2>

        {!telegramConnected ? (
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2"
            />
            <button
              onClick={handleConnectTelegram}
              disabled={!botToken}
              className={`bg-blue-600 text-white px-4 py-2 rounded-lg ${!botToken ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}`}
            >
              Connect Bot
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-100">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.17 2.06c.36-.08.73.13.84.48.06.19.03.39-.08.55L11.54 18.5l-6-3.8 2.5-1.55L19.42 3.12a.6.6 0 0 1 1.75-1.06zM2 12v3l5 3v-3H2z" /></svg>
              </div>
              <div>
                <p className="font-medium text-green-900">
                  Bot Active
                </p>
                <p className="text-sm text-green-700">
                  {telegramUsername ? `@${telegramUsername}` : "Connected"}
                </p>
              </div>
            </div>

            <button
              onClick={handleDisconnectTelegram}
              className="text-red-500 text-sm hover:underline hover:text-red-600 px-3 py-1 bg-app-surface border border-red-100 rounded-lg shadow-sm"
            >
              Disconnect
            </button>
          </div>
        )}

        <p className="text-xs text-app-muted mt-2">
          Paste your bot token from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-500 underline">BotFather</a> to connect.
        </p>
      </div>

      {/* INSTAGRAM */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Instagram Integration</h2>
            <p className="text-xs text-app-muted">Receive and reply to Instagram DMs via your AI bot</p>
          </div>
        </div>

        {!instagramConnected ? (
          <div className="space-y-3">
            {/* Webhook URL hint */}
            <div className="bg-app-bg rounded-xl px-4 py-3 border border-app space-y-1">
              <p className="text-xs font-bold text-app-muted uppercase tracking-wide">Step 1 — Register Webhook in Meta Developer Console</p>
              <p className="text-xs text-app-muted">Callback URL (paste this in your Meta App → Webhooks):</p>
              <code className="block text-xs bg-app-surface border border-app rounded-lg px-3 py-2 font-mono text-indigo-700 break-all select-all">
                {DISPLAY_WEBHOOK_URL}
              </code>
              <p className="text-xs text-slate-400 mt-1">Verify Token: use <span className="font-mono bg-app-bg-soft px-1 rounded">{igVerifyToken || "leadsync_ig_verify_2026"}</span> in Meta App verification.</p>
            </div>

            <p className="text-xs font-bold text-app-muted uppercase tracking-wide">Step 2 — Enter Page Credentials</p>
            <input
              type="text"
              placeholder="Instagram Page ID (numeric, e.g. 1234567890)"
              value={igPageIdInput}
              onChange={(e) => setIgPageIdInput(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
            <div className="flex gap-3">
              <input
                type="password"
                placeholder="Long-lived Page Access Token"
                value={igTokenInput}
                onChange={(e) => setIgTokenInput(e.target.value)}
                className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              <button
                onClick={handleConnectInstagram}
                disabled={!igPageIdInput || !igTokenInput}
                className={`bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition ${(!igPageIdInput || !igTokenInput) ? "opacity-50 cursor-not-allowed" : "hover:from-pink-600 hover:to-purple-700"}`}
              >
                Connect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-pink-50 p-4 rounded-xl border border-pink-100">
              <div className="flex items-center gap-3">
                <div className="bg-pink-100 p-2 rounded-full text-pink-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </div>
                <div>
                  <p className="font-semibold text-pink-900">Instagram Active</p>
                  <p className="text-xs text-pink-600 font-mono">Page ID: {instagramPageId}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectInstagram}
                className="text-red-500 text-sm hover:text-red-600 px-3 py-1.5 bg-app-surface border border-red-100 rounded-lg shadow-sm transition"
              >
                Disconnect
              </button>
            </div>
            {/* Webhook URL reminder when connected */}
            <div className="bg-app-bg rounded-xl px-4 py-3 border border-app">
              <p className="text-xs font-bold text-app-muted uppercase tracking-wide mb-1">Webhook URL (for Meta App)</p>
              <code className="text-xs font-mono text-indigo-700 break-all select-all">
                {DISPLAY_WEBHOOK_URL}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* COMMERCE AI ONBOARDING WIZARD */}
      <div className="bg-app-surface p-8 rounded-3xl shadow-xl border border-app space-y-6 relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>

        <div className="relative">
          <h2 className="text-2xl font-black text-app-text tracking-tight flex items-center gap-2">
            <span>📦</span> Commerce Onboarding
          </h2>
          <p className="text-app-muted text-sm mt-1">Populate your shop menu using AI paste or manual entry.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 bg-app-bg-soft rounded-xl w-fit">
          <button
            onClick={() => setOnboardingMode('PASTE')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'PASTE' ? 'bg-app-surface text-indigo-600 shadow-sm' : 'text-app-muted hover:text-app-text'}`}
          >
            ✨ AI Smart Paste
          </button>
          <button
            onClick={() => setOnboardingMode('MANUAL')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'MANUAL' ? 'bg-app-surface text-indigo-600 shadow-sm' : 'text-app-muted hover:text-app-text'}`}
          >
            🧱 Manual Entry
          </button>
          <button
            onClick={() => setOnboardingMode('FILE')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'FILE' ? 'bg-app-surface text-indigo-600 shadow-sm' : 'text-app-muted hover:text-app-text'}`}
          >
            🧾 Upload Document
          </button>
        </div>

        {onboardingMode === 'PASTE' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Instructions</p>
              <p className="text-sm text-indigo-900/70">Paste your raw product list, price menu, or even a WhatsApp message. Our AI will extract items and prices for you.</p>
            </div>

            <textarea
              placeholder="Ex: 
Cold Brew Coffee - 250
Latte - 300
Cheese Croissant 180..."
              value={shopDescription}
              onChange={(e) => setShopDescription(e.target.value)}
              className="w-full border-2 border-app rounded-2xl px-4 py-4 h-48 focus:border-indigo-500 focus:ring-0 transition-all text-sm font-medium bg-app-bg/30"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={handleAnalyzeSmartPaste}
                disabled={isGenerating || !shopDescription.trim()}
                className={`bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95 ${isGenerating ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-700 hover:shadow-indigo-200"}`}
              >
                {isGenerating ? "Analyzing..." : "Analyze & Preview"}
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mergeCheck"
                  checked={mergeWithExisting}
                  onChange={(e) => setMergeWithExisting(e.target.checked)}
                  className="rounded border-app-border-strong text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mergeCheck" className="text-xs font-bold text-app-muted cursor-pointer">Merge with existing items</label>
              </div>
            </div>
          </div>
        ) : onboardingMode === 'FILE' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Document Analysis</p>
                <p className="text-sm text-indigo-900/70">Upload PDF, Word, Excel, or CSV catalogs.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={downloadCsvTemplate}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Download CSV Template ↓
                </button>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-app rounded-3xl cursor-pointer hover:bg-app-bg hover:border-indigo-400 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <div className="bg-indigo-50 p-4 rounded-full text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                </div>
                <p className="text-sm font-bold text-app-muted">Click to upload catalog</p>
                <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, XLSX, CSV (Max 10MB)</p>
              </div>
              <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Business Category</label>
                <input
                  type="text"
                  placeholder="e.g. Organic Cafe"
                  value={botBusinessType}
                  onChange={(e) => setBotBusinessType(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bot Welcome Message</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome to our store!"
                  value={botWelcomeMessage}
                  onChange={(e) => setBotWelcomeMessage(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-app-muted italic">Use the "Edit Menu" section below to manage your catalog once items are added.</p>
            <button
              onClick={saveEditedMenu}
              className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-900 transition-all text-sm"
            >
              Save Basic Settings
            </button>
          </div>
        )}
      </div>

      {/* PREVIEW MODAL / SECTION */}
      {previewMenu && (
        <div className="bg-amber-50 p-8 rounded-3xl border-2 border-amber-200 shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-amber-900 tracking-tight flex items-center gap-2">
                <span>👁️</span> Extraction Preview
              </h3>
              <p className="text-amber-800/60 text-sm font-medium">Verify the data before committing to your shop.</p>
            </div>
            <button
              onClick={() => setPreviewMenu(null)}
              className="text-amber-900/40 hover:text-amber-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {previewMenu.categories.map((cat, ci) => (
              <div key={ci} className="bg-app-surface p-4 rounded-2xl border border-amber-100 shadow-sm">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 px-1">{cat.name}</p>
                <div className="space-y-1.5">
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="text-app-text font-medium">{item.name}</span>
                      <span className="text-indigo-600 font-bold">₹{item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleConfirmPreview}
              className="flex-1 bg-green-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-100 hover:bg-green-700 hover:shadow-green-200 transition-all active:scale-95"
            >
              Confirm & Save to Menu ✅
            </button>
            <button
              onClick={() => setPreviewMenu(null)}
              className="bg-app-surface text-app-muted px-6 py-4 rounded-2xl font-bold border border-app hover:bg-app-bg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI KNOWLEDGE BASE & LEARNING */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🧠</span> AI Shop Knowledge (Advanced Tuning)
        </h2>
        <p className="text-sm text-app-muted">
          Enter detailed descriptions, suggestions, or "facts" about your products here. The AI will learn from this to answer customer questions better.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Raw Item Descriptions / Notes
            </label>
            <textarea
              placeholder="Ex: 'Our Tracksuits are 100% cotton and perfect for gym. Suggest them if customers ask for breathable fabric.'"
              value={botKnowledgeBase}
              onChange={(e) => setBotKnowledgeBase(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-48 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. What the AI Learnt (Editable)
            </label>
            <textarea
              placeholder="AI summary will appear here..."
              value={botLearnedContext}
              onChange={(e) => setBotLearnedContext(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-48 text-sm bg-app-bg italic"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleTrainAI}
            disabled={isTraining}
            className={`bg-indigo-600 text-white px-5 py-2 rounded-lg transition shadow-sm ${isTraining ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-700"
              }`}
          >
            {isTraining ? "AI is Learning..." : "Train AI Now 🚀"}
          </button>

          <button
            onClick={handleSaveKnowledge}
            className="border border-app text-app-muted px-5 py-2 rounded-lg hover:bg-app-bg transition"
          >
            Save Knowledge Manually
          </button>
        </div>
      </div>

      {/* SHOP POLICIES */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>📜</span> Shop Policies (Grounded Rules)
        </h2>
        <p className="text-sm text-app-muted">
          Define your delivery times, return policies, or store rules. The AI will use these to answer customer queries.
        </p>

        <textarea
          placeholder="Ex: 'Delivery takes 2 days. No returns on food items. Open from 9 AM to 9 PM.'"
          value={botPolicies}
          onChange={(e) => setBotPolicies(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 h-32 text-sm font-mono"
        />

        <div className="flex justify-end">
          <button
            onClick={handleSaveKnowledge}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg hover:bg-slate-900 transition shadow-sm"
          >
            Save Policies
          </button>
        </div>
      </div>

      {/* MENU EDITOR */}
      {generatedMenu && (
        <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-6">
          <h2 className="text-lg font-semibold">
            Edit Menu (with Pricing)
          </h2>

          {generatedMenu.categories.map((cat: Category, cIndex: number) => (
            <div key={cIndex} className="border p-4 rounded-xl space-y-4">
              <div className="flex justify-between items-center">
                <input
                  value={cat.name}
                  onChange={(e) =>
                    updateCategoryName(cIndex, e.target.value)
                  }
                  className="border px-2 py-1 rounded text-sm font-semibold"
                />
                <button
                  onClick={() => deleteCategory(cIndex)}
                  className="text-red-500 text-xs"
                >
                  Delete
                </button>
              </div>

              {cat.items.map((item: MenuItem, iIndex: number) => (
                <div key={iIndex} className="flex gap-3 items-center">
                  <input
                    value={item.name}
                    onChange={(e) =>
                      updateItem(
                        cIndex,
                        iIndex,
                        "name",
                        e.target.value
                      )
                    }
                    className="flex-1 border px-2 py-1 rounded text-sm"
                  />

                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) =>
                      updateItem(
                        cIndex,
                        iIndex,
                        "price",
                        e.target.value
                      )
                    }
                    className="w-24 border px-2 py-1 rounded text-sm"
                  />

                  <button
                    onClick={() => deleteItem(cIndex, iIndex)}
                    className="text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                onClick={() => addItem(cIndex)}
                className="text-indigo-600 text-sm"
              >
                + Add Item
              </button>
            </div>
          ))}

          <button
            onClick={addCategory}
            className="text-indigo-600 text-sm"
          >
            + Add Category
          </button>

          <div>
            <button
              onClick={saveEditedMenu}
              className="bg-green-600 text-white px-5 py-2 rounded-lg"
            >
              Save Menu Changes
            </button>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
