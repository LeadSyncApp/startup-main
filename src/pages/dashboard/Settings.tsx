import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { api } from "../../lib/api";

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

const PRESETS = {
  "Organic Cafe": {
    menu: {
      categories: [
        { name: "Coffee", items: [{ name: "Cold Brew Coffee", price: 250 }, { name: "Oat Milk Latte", price: 320 }] },
        { name: "Bakery", items: [{ name: "Cheddar Croissant", price: 180 }, { name: "Avocado Toast", price: 450 }] }
      ]
    },
    knowledge: "Our Cold Brew is steeped for 24 hours for a smooth, low-acid finish. Croissants are baked fresh daily at 7 AM. We use only organic, locally sourced ingredients.",
    policies: "delivery_area: within 5km of Indiranagar\ndelivery_time: 30-45 mins\nreturns: No returns on food items.\nask_for_location: true",
    welcome: "Welcome to our Organic Cafe! ☕ Freshly brewed and ready for you."
  },
  "Clothing Store": {
    menu: {
      categories: [
        { name: "Summer Wear", items: [{ name: "Linen Shirt", price: 1200 }, { name: "Cotton Shorts", price: 800 }] },
        { name: "Accessories", items: [{ name: "Canvas Tote Bag", price: 350 }, { name: "Silk Scarf", price: 950 }] }
      ]
    },
    knowledge: "All shirts are pre-shrunk and made from 100% organic cotton. Linen is sourced from Belgium. Sizes range from S to XXL.",
    policies: "delivery_area: Pan-India via BlueDart\nreturns: 30-day easy returns if tags are intact.\nshipping_fee: Free on orders above 2000 INR.\nask_for_location: false",
    welcome: "Welcome to our Sustainable Clothing Store! 🌿 Wear the change."
  },
  "Bakery": {
    menu: {
      categories: [
        { name: "Signature Cakes", items: [{ name: "Belgian Chocolate Cake", price: 1500 }, { name: "Red Velvet Bliss", price: 1200 }] },
        { name: "Daily Treats", items: [{ name: "Blueberry Muffin", price: 120 }, { name: "Customized Cupcake", price: 80 }] }
      ]
    },
    knowledge: "We take custom cake orders with 24-hour notice. All bakes are eggless by default unless specified. We use high-quality imported cocoa.",
    policies: "delivery_area: within 10km radius\ndelivery_time: Slots at 10 AM, 2 PM, 6 PM\nconfirmation_required: true\nask_for_location: true",
    welcome: "Welcome to The Sourdough Studio! 🥐 Sweet treats for everyday joy."
  },
  "Salon": {
    menu: {
      categories: [
        { name: "Hair Care", items: [{ name: "Professional Haircut", price: 600 }, { name: "Deep Conditioning Spa", price: 1500 }] },
        { name: "Skin Care", items: [{ name: "Organic Glow Facial", price: 2200 }, { name: "Fruit Peel", price: 1800 }] }
      ]
    },
    knowledge: "Our stylists have 5+ years of experience. We use only paraben-free, vegan products. Appointments are mandatory for weekends.",
    policies: "booking: Mandatory on weekends via link.\ncancellation: 4 hours notice required.\nmembership: 10% off for silver members.\nask_for_location: false",
    welcome: "Welcome to Aura Wellness Salon! ✨ Glow like never before."
  }
};

export default function Settings() {
  const { token, user } = useAuth();
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

  const [onboardingMode, setOnboardingMode] = useState<'PASTE' | 'MANUAL' | 'FILE'>('PASTE');
  const [previewMenu, setPreviewMenu] = useState<StructuredMenu | null>(null);
  const [mergeWithExisting, setMergeWithExisting] = useState(true);
  const [generatedMenu, setGeneratedMenu] = useState<StructuredMenu | null>(null);


  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllPresets, setShowAllPresets] = useState(false);

  const handleLoadPreset = (presetName: keyof typeof PRESETS) => {
    const confirm = window.confirm(`This will overwrite menu, learned knowledge, and policies for your shop (Tenant ID: ${user?.companyId || 'current'}) only. This only affects your shop data.\n\nContinue?`);
    if (!confirm) return;

    const p = PRESETS[presetName];
    setBotBusinessType(presetName);
    setGeneratedMenu(p.menu as any);
    setBotKnowledgeBase(p.knowledge);
    setBotPolicies(p.policies);
    setBotWelcomeMessage(p.welcome);
    setBotLearnedContext("Click 'Train AI' to process this preset...");
    toast.success(`Loaded demo data for ${presetName}! Now save and train.`);
  };

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

  /* ===============================
     UI
  =============================== */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-slate-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl pb-12">

      {/* 🧪 DEMO DATA SELECTOR */}
      <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white h-10 w-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="font-bold text-xl">🧪</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-indigo-900">Load Demo Data (for your business type)</h2>
              <p className="text-sm text-indigo-600/70 font-medium">Quickly populate your shop with realistic demo data for testing.</p>
            </div>
          </div>

          {(user?.role === "ADMIN" || user?.role === "OWNER") && (
            <button
              onClick={() => setShowAllPresets(!showAllPresets)}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              {showAllPresets ? "Hide Other Presets" : "Switch business type / view other presets"}
            </button>
          )}
        </div>

        {!botBusinessType && !showAllPresets ? (
          <div className="bg-white/50 p-4 rounded-xl border border-indigo-100 text-center">
            <p className="text-sm text-indigo-900 font-bold mb-3 uppercase tracking-wide">Select your business type in "Merchant Profile" first</p>
            <p className="text-xs text-indigo-600/60">Or use the advanced link above to see all demographics.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.keys(PRESETS)
              .filter(name => showAllPresets || name === botBusinessType)
              .map((name) => (
                <button
                  key={name}
                  onClick={() => handleLoadPreset(name as keyof typeof PRESETS)}
                  className={`
                  px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 border
                  ${name === botBusinessType
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200"
                      : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"}
                `}
                >
                  {name === botBusinessType ? `✅ Load ${name}` : name}
                </button>
              ))}
          </div>
        )}

        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest text-center">
          ⚠️ This only affects your shop data.
        </p>
      </div>

      {/* PROFILE */}
      <div className="bg-white p-6 rounded-2xl shadow border">
        <h2 className="text-lg font-semibold mb-3">Profile</h2>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> {user?.role}</p>
      </div>

      {/* BUSINESS DETAILS (FOR INVOICING) */}
      <div className="bg-white p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🏢</span> Business Details (for Invoices)
        </h2>
        <p className="text-sm text-slate-500">
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

      {/* TELEGRAM */}
      <div className="bg-white p-6 rounded-2xl shadow border space-y-4">
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
              className="text-red-500 text-sm hover:underline hover:text-red-600 px-3 py-1 bg-white border border-red-100 rounded-lg shadow-sm"
            >
              Disconnect
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-2">
          Paste your bot token from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-500 underline">BotFather</a> to connect.
        </p>
      </div>

      {/* INSTAGRAM */}
      <div className="bg-white p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold">
          Instagram Integration
        </h2>

        {!instagramConnected ? (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Instagram Page ID"
              value={igPageIdInput}
              onChange={(e) => setIgPageIdInput(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
            <div className="flex gap-3">
              <input
                type="password"
                placeholder="Page Access Token"
                value={igTokenInput}
                onChange={(e) => setIgTokenInput(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                onClick={handleConnectInstagram}
                disabled={!igPageIdInput || !igTokenInput}
                className={`bg-pink-600 text-white px-4 py-2 rounded-lg ${(!igPageIdInput || !igTokenInput) ? "opacity-50 cursor-not-allowed" : "hover:bg-pink-700"}`}
              >
                Connect IG
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center bg-pink-50 p-4 rounded-xl border border-pink-100">
            <div className="flex items-center gap-3">
              <div className="bg-pink-100 p-2 rounded-full text-pink-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </div>
              <div>
                <p className="font-medium text-pink-900">
                  Instagram Active
                </p>
                <p className="text-sm text-pink-700">
                  Page ID: {instagramPageId}
                </p>
              </div>
            </div>

            <button
              onClick={handleDisconnectInstagram}
              className="text-red-500 text-sm hover:underline hover:text-red-600 px-3 py-1 bg-white border border-red-100 rounded-lg shadow-sm"
            >
              Disconnect
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-2">
          Connect your Instagram Business Page by providing the Page ID and a Long-lived Page Access Token.
        </p>
      </div>

      {/* COMMERCE AI ONBOARDING WIZARD */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6 relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>

        <div className="relative">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span>📦</span> Commerce Onboarding
          </h2>
          <p className="text-slate-500 text-sm mt-1">Populate your shop menu using AI paste or manual entry.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setOnboardingMode('PASTE')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'PASTE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ✨ AI Smart Paste
          </button>
          <button
            onClick={() => setOnboardingMode('MANUAL')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'MANUAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🧱 Manual Entry
          </button>
          <button
            onClick={() => setOnboardingMode('FILE')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'FILE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
              className="w-full border-2 border-slate-100 rounded-2xl px-4 py-4 h-48 focus:border-indigo-500 focus:ring-0 transition-all text-sm font-medium bg-slate-50/30"
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
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mergeCheck" className="text-xs font-bold text-slate-500 cursor-pointer">Merge with existing items</label>
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

            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <div className="bg-indigo-50 p-4 rounded-full text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                </div>
                <p className="text-sm font-bold text-slate-600">Click to upload catalog</p>
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
            <p className="text-xs text-slate-500 italic">Use the "Edit Menu" section below to manage your catalog once items are added.</p>
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
              <div key={ci} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 px-1">{cat.name}</p>
                <div className="space-y-1.5">
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-700 font-medium">{item.name}</span>
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
              className="bg-white text-slate-500 px-6 py-4 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI KNOWLEDGE BASE & LEARNING */}
      <div className="bg-white p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🧠</span> AI Shop Knowledge (Advanced Tuning)
        </h2>
        <p className="text-sm text-slate-500">
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
              className="w-full border rounded-lg px-3 py-2 h-48 text-sm bg-slate-50 italic"
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
            className="border border-slate-200 text-slate-600 px-5 py-2 rounded-lg hover:bg-slate-50 transition"
          >
            Save Knowledge Manually
          </button>
        </div>
      </div>

      {/* SHOP POLICIES */}
      <div className="bg-white p-6 rounded-2xl shadow border space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>📜</span> Shop Policies (Grounded Rules)
        </h2>
        <p className="text-sm text-slate-500">
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
        <div className="bg-white p-6 rounded-2xl shadow border space-y-6">
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
    </div>
  );
}
