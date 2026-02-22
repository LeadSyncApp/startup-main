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

export default function Settings() {
  const { token, user } = useAuth();

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

  // Instagram State
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [instagramPageId, setInstagramPageId] = useState("");
  const [igPageIdInput, setIgPageIdInput] = useState("");
  const [igTokenInput, setIgTokenInput] = useState("");

  const [generatedMenu, setGeneratedMenu] = useState<StructuredMenu | null>(null);
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

        // Config
        if (configData.company) {
          setBotBusinessType(configData.company.botBusinessType || "");
          setBotWelcomeMessage(configData.company.botWelcomeMessage || "");
          setGeneratedMenu(configData.company.botStructuredMenu || null);
          setBotKnowledgeBase(configData.company.botKnowledgeBase || "");
          setBotLearnedContext(configData.company.botLearnedContext || "");
          setBotPolicies(configData.company.botPolicies || "");
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
     GENERATE MENU
  =============================== */
  const handleGenerateMenu = async () => {
    if (!shopDescription.trim()) {
      toast.error("Describe your shop first");
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading("Generating menu via AI... (This may take 15s)");

    try {
      const data = await api.patch("/dashboard/bot-config", {
        botBusinessType,
        botWelcomeMessage,
        shopDescription,
      });

      setGeneratedMenu(data.company.botStructuredMenu);
      setShopDescription("");

      toast.success(
        shopDescription.toLowerCase().includes("update")
          ? "Menu updated successfully! ✅"
          : "Menu generated successfully! 🎉",
        { id: toastId }
      );
    } catch (err) {
      console.error("Generate error:", err);
      toast.error("Failed to generate menu. Please try again.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
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
      await api.patch("/dashboard/save-edited-menu", {
        structuredMenu: generatedMenu,
        botBusinessType,
        botWelcomeMessage,
      });

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
    <div className="space-y-8 max-w-4xl">

      {/* PROFILE */}
      <div className="bg-white p-6 rounded-2xl shadow border">
        <h2 className="text-lg font-semibold mb-3">Profile</h2>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> {user?.role}</p>
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

      {/* MENU GENERATOR */}
      <div className="bg-white p-6 rounded-2xl shadow border space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">AI Menu Generator</h2>
          {generatedMenu && (
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
              ✓ Menu Active
            </span>
          )}
        </div>

        <input
          type="text"
          placeholder="Business Type"
          value={botBusinessType}
          onChange={(e) => setBotBusinessType(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />

        <textarea
          placeholder="Bot Welcome Message (e.g. 'Hello there!')"
          value={botWelcomeMessage}
          onChange={(e) => setBotWelcomeMessage(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 h-20"
        />

        <textarea
          placeholder="Describe your shop... (or 'update price of X')"
          value={shopDescription}
          onChange={(e) => setShopDescription(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 h-24"
        />

        <div className="flex gap-3">
          <button
            onClick={handleGenerateMenu}
            disabled={isGenerating}
            className={`bg-purple-600 text-white px-4 py-2 rounded-lg transition ${isGenerating ? "opacity-50 cursor-not-allowed" : "hover:bg-purple-700"
              }`}
          >
            {isGenerating ? "Generating..." : "AI Generate Menu"}
          </button>

          <button
            onClick={saveEditedMenu}
            className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition"
          >
            Save Basic Config
          </button>
        </div>
      </div>

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
