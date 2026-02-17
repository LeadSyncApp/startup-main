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

        // Config
        if (configData.company) {
          setBotBusinessType(configData.company.botBusinessType || "");
          setBotWelcomeMessage(configData.company.botWelcomeMessage || "");
          setGeneratedMenu(configData.company.botStructuredMenu || null);
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
      });

      setTelegramConnected(true);
      setTelegramUsername(data.botUsername);
      setBotToken("");

      toast.success("Telegram connected 🚀");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
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
          <>
            <input
              type="text"
              placeholder="Bot Token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
            <button
              onClick={handleConnectTelegram}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Connect Telegram
            </button>
          </>
        ) : (
          <div className="flex justify-between items-center">
            <p className="text-green-600">
              Connected as @{telegramUsername}
            </p>
            <button
              onClick={handleDisconnectTelegram}
              className="text-red-500 text-sm hover:underline"
            >
              Disconnect
            </button>
          </div>
        )}
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
