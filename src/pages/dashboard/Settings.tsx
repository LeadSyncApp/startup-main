import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { api } from "../../lib/api";

export default function Settings() {
  const { token, user } = useAuth();

  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);

  const [botBusinessType, setBotBusinessType] = useState("");
  const [botWelcomeMessage, setBotWelcomeMessage] = useState("");
  const [shopDescription, setShopDescription] = useState("");

  const [generatedMenu, setGeneratedMenu] = useState<any>(null);

  /* FETCH STATUS */
  useEffect(() => {
    if (!token) return;

    const fetchStatus = async () => {
      const data = await api.get("/integrations/status");
      setTelegramConnected(data.telegram?.connected || false);
      setTelegramUsername(data.telegram?.username || null);
    };

    fetchStatus();
  }, [token]);

  /* FETCH BOT CONFIG */
  useEffect(() => {
    if (!token) return;

    const fetchBotConfig = async () => {
      const data = await api.get("/dashboard/bot-config");

      if (data.company) {
        setBotBusinessType(data.company.botBusinessType || "");
        setBotWelcomeMessage(data.company.botWelcomeMessage || "");
        setGeneratedMenu(data.company.botStructuredMenu || null);
      }
    };

    fetchBotConfig();
  }, [token]);

  /* CONNECT TELEGRAM */
  const handleConnectTelegram = async () => {
    if (!botToken.trim()) {
      toast.error("Bot token required");
      return;
    }

    try {
      setLoading(true);

      const data = await api.post("/integrations/telegram/connect", {
        token: botToken,
      });

      setTelegramConnected(true);
      setTelegramUsername(data.botUsername);
      setBotToken("");

      toast.success("Telegram connected 🚀");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  /* GENERATE / MERGE MENU */
  const handleGenerateMenu = async () => {
    if (!shopDescription.trim()) {
      toast.error("Please describe your shop");
      return;
    }

    try {
      setLoading(true);

      const data = await api.patch("/dashboard/bot-config", {
        botBusinessType,
        botWelcomeMessage,
        shopDescription,
      });

      setGeneratedMenu(data.company?.botStructuredMenu);
      setShopDescription("");

      toast.success("Menu updated 🎉");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  /* DELETE CATEGORY */
  const deleteCategory = (index: number) => {
    const updated = { ...generatedMenu };
    updated.categories.splice(index, 1);
    setGeneratedMenu(updated);
  };

  /* DELETE ITEM */
  const deleteItem = (catIndex: number, itemIndex: number) => {
    const updated = { ...generatedMenu };
    updated.categories[catIndex].items.splice(itemIndex, 1);
    setGeneratedMenu(updated);
  };

  /* SAVE MANUAL EDIT */
  const saveEditedMenu = async () => {
    try {
      setLoading(true);

      const data = await api.patch("/dashboard/save-edited-menu", {
        structuredMenu: generatedMenu,
        botBusinessType,
        botWelcomeMessage,
      });

      setGeneratedMenu(data.company.botStructuredMenu);
      toast.success("Menu saved successfully ✅");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">

      {/* PROFILE */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> {user?.role}</p>
      </div>

      {/* TELEGRAM */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">
          Telegram Integration
        </h2>

        {!telegramConnected ? (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Paste your Bot Token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />

            <button
              onClick={handleConnectTelegram}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
            >
              {loading ? "Connecting..." : "Connect Telegram"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            <div className="text-green-600 font-medium">
              ✅ Connected as @{telegramUsername}
            </div>

            {/* BOT CONFIG */}
            <div className="border-t pt-4 space-y-4">

              <input
                type="text"
                placeholder="Business Type"
                value={botBusinessType}
                onChange={(e) => setBotBusinessType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />

              <input
                type="text"
                placeholder="Welcome Message"
                value={botWelcomeMessage}
                onChange={(e) => setBotWelcomeMessage(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />

              <textarea
                placeholder="Describe your shop..."
                value={shopDescription}
                onChange={(e) => setShopDescription(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm h-28"
              />

              <button
                onClick={handleGenerateMenu}
                className="bg-purple-600 text-white px-4 py-2 rounded"
              >
                Generate / Update Menu
              </button>

              {/* MENU PREVIEW WITH DELETE */}
              {generatedMenu && (
                <div className="space-y-4">
                  {generatedMenu.categories.map((cat: any, cIndex: number) => (
                    <div key={cIndex} className="border p-4 rounded bg-gray-50">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">{cat.name}</p>
                        <button
                          onClick={() => deleteCategory(cIndex)}
                          className="text-red-500 text-xs"
                        >
                          Delete Category
                        </button>
                      </div>

                      <div className="mt-2 space-y-1">
                        {cat.items.map((item: string, iIndex: number) => (
                          <div key={iIndex} className="flex justify-between text-sm">
                            <span>{item}</span>
                            <button
                              onClick={() => deleteItem(cIndex, iIndex)}
                              className="text-red-400 text-xs"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={saveEditedMenu}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Save Changes
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
