import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { PageTransition } from "@/components/ui/Animations";

// Fixed display-only webhook URL constant
const DISPLAY_WEBHOOK_URL = "https://your-api-domain.com/api/instagram/webhook";

import { SavedRepliesManager } from "@/components/conversations/SavedReplies";
import { BotKnowledgeManager } from "@/components/settings/BotKnowledgeManager";
import { AutomationManager } from "@/components/settings/AutomationManager";
import { AssignmentStrategyManager } from "@/components/settings/AssignmentStrategyManager";

// Newly created subcomponents
import { ProfileSection } from "./ProfileSection";
import { BusinessDetailsSection } from "./BusinessDetailsSection";
import { TelegramIntegration } from "./TelegramIntegration";
import { InstagramIntegration } from "./InstagramIntegration";
import { CommerceOnboardingSection } from "./CommerceOnboardingSection";
import { AdvancedTuningSection } from "./AdvancedTuningSection";
import { MenuEditorSection } from "./MenuEditorSection";

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
      <TelegramIntegration 
        telegramConnected={telegramConnected}
        telegramUsername={telegramUsername}
        botToken={botToken}
        setBotToken={setBotToken}
        handleConnectTelegram={handleConnectTelegram}
        handleDisconnectTelegram={handleDisconnectTelegram}
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

      {/* COMMERCE AI ONBOARDING WIZARD */}
      <CommerceOnboardingSection 
        onboardingMode={onboardingMode}
        setOnboardingMode={setOnboardingMode}
        shopDescription={shopDescription}
        setShopDescription={setShopDescription}
        isGenerating={isGenerating}
        handleAnalyzeSmartPaste={handleAnalyzeSmartPaste}
        mergeWithExisting={mergeWithExisting}
        setMergeWithExisting={setMergeWithExisting}
        handleFileUpload={handleFileUpload}
        downloadCsvTemplate={downloadCsvTemplate}
        botBusinessType={botBusinessType}
        setBotBusinessType={setBotBusinessType}
        botWelcomeMessage={botWelcomeMessage}
        setBotWelcomeMessage={setBotWelcomeMessage}
        saveEditedMenu={saveEditedMenu}
        previewMenu={previewMenu}
        setPreviewMenu={setPreviewMenu}
        handleConfirmPreview={handleConfirmPreview}
      />

      {/* AI KNOWLEDGE BASE & LEARNING & SHOP POLICIES */}
      <AdvancedTuningSection 
        botKnowledgeBase={botKnowledgeBase}
        setBotKnowledgeBase={setBotKnowledgeBase}
        botLearnedContext={botLearnedContext}
        setBotLearnedContext={setBotLearnedContext}
        isTraining={isTraining}
        handleTrainAI={handleTrainAI}
        handleSaveKnowledge={handleSaveKnowledge}
        botPolicies={botPolicies}
        setBotPolicies={setBotPolicies}
      />

      {/* MENU EDITOR */}
      <MenuEditorSection 
        generatedMenu={generatedMenu}
        updateCategoryName={updateCategoryName}
        updateItem={updateItem}
        addCategory={addCategory}
        addItem={addItem}
        deleteCategory={deleteCategory}
        deleteItem={deleteItem}
        saveEditedMenu={saveEditedMenu}
      />

    </PageTransition>
  );
}
