import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import toast from "react-hot-toast";

interface BotCommand {
  command: string;
  description: string;
  action?: string;
  customReplyText?: string;
  behaviorMode?: "append" | "override";
  lastCompiledReply?: string;
}

interface TelegramIntegrationProps {
  telegramConnected: boolean;
  telegramUsername: string | null;
  botToken: string;
  setBotToken: (value: string) => void;
  handleConnectTelegram: () => void;
  handleDisconnectTelegram: () => void;
  botCommands: BotCommand[];
  onSaveCommands: (commands: BotCommand[]) => Promise<void>;
}

function getButtonFunctionDescription(btnName: string, action: string, command: string) {
  const normBtn = btnName.toLowerCase();
  
  // 1️⃣ SYSTEM INTEGRATION ACTIONS
  if (normBtn.includes("menu") || normBtn.includes("catalog")) {
    return "SERVER LOGIC: Calls './bot.logic.ts#handleViewMenuAction'. Connects to SQL database via Prisma to extract real-time categories into a summarized markdown list.";
  }
  if (normBtn.includes("language") || normBtn.includes("translation") || normBtn.includes("hindi") || normBtn.includes("tamil")) {
    return "SERVER LOGIC: Triggers the lang_selection_prompt flow. Updates 'Lead#preferredLanguage' flag to shift the Groq/Gemini context script and native character generation.";
  }
  if (normBtn.includes("support") || normBtn.includes("human") || normBtn.includes("agent") || normBtn.includes("help")) {
    return "SERVER LOGIC: Executes 'prisma.conversation.update' [mode: HUMAN]. Immediately halts AI loop, flags CRM dashboard with 'Handover Required', and triggers a Webhook alert to shop staff.";
  }
  if (normBtn.includes("reset") || normBtn.includes("clear") || normBtn.includes("cart") || normBtn.includes("delete")) {
    return "SERVER LOGIC: Resets the 'sessionState' object in Postgres. Wipes 'cart.items[]', 'total', and resets the AI's short-term memory buffer (last_item_names, last_category).";
  }
  if (normBtn.includes("confirm") || normBtn.includes("order") || normBtn.includes("checkout")) {
    return "SERVER LOGIC: Validates items against active menu. Converts current session cart into a formal 'Order' record and triggers 'newOrderArrivalService' for merchant notification.";
  }
  
  // 2️⃣ DYNAMIC CATALOG FILTERS
  if (command === "menu" || action === "view_menu" || action === "start" || command === "catalog") {
    return `CATALOG LOGIC: Deep-links to the "${btnName}" category. The AI will perform a semantic filter on 'menu_snapshot' to list items matching this specific category identifier.`;
  }
  
  // 3️⃣ AI CUSTOM RESPONSE
  return `AI AGENT LOGIC: Groq/Gemini will interpret this as a custom intention. It will generate a unique contextual response based on the "Bot Knowledge" base and your specific prompt instructions.`;
}

function getCommandSystemBehavior(item: BotCommand) {
  const normCmd = (item.command || "").toLowerCase().trim();
  const act = (item.action || "none").toLowerCase().trim();
  const customPrompt = item.customReplyText;

  let baseTitle = "✨ Custom AI Assistant Chat";
  let baseAction = "The AI intelligently evaluates the message context to generate a helpful response.";
  let buttons: string[] = [];

  // Parse lastCompiledReply if available
  if (item.lastCompiledReply) {
    const lines = item.lastCompiledReply.split("\n");
    const parsedButtons = lines
      .filter(l => l.startsWith("BUTTON:"))
      .map(l => l.replace("BUTTON:", "").trim());
    
    if (parsedButtons.length > 0) {
      buttons = parsedButtons;
      baseTitle = "💾 Stateful Memory Active";
      baseAction = "Using last successfully generated layout as baseline";
    }
  }

  // Regular fallback logic if no compiled reply or if we want to show base behavior
  if (buttons.length === 0) {
    if (act === "start" || (normCmd === "start" && act === "none")) {
      baseTitle = "👋 Welcome & Onboarding Flow";
      baseAction = "Greeting & Onboarding";
      buttons = ["View Menu", "Select Language", "View Discount"];
    } else if (act === "view_menu" || (normCmd === "menu" && act === "none")) {
      baseTitle = "📖 Catalog Menu Listing";
      baseAction = "Dynamic Menu Extraction";
      buttons = ["Add to Cart (AI)"];
    } else if (act === "transfer_human" || (normCmd === "help" && act === "none")) {
      baseTitle = "👤 Live Representative Support Transfer";
      baseAction = "Pause AI & Notify Human Team";
      buttons = ["Chat with Support"];
    } else if (act === "clear_cart" || (normCmd === "clear" && act === "none")) {
      baseTitle = "🧹 Reset & Cart Erasure";
      baseAction = "Wipe Cart & Session Reset";
    }
  }

  // Live Parsing logic for the "Preview" (incremental feedback)
  if (customPrompt) {
    const buttonAddRegex = /add (?:a )?(?:new )?button (?:named |called )?["']?([^"']+)["']?/gi;
    let match;
    const detectedButtons: string[] = [];
    while ((match = buttonAddRegex.exec(customPrompt)) !== null) {
      const btnName = match[1];
      if (!buttons.includes(btnName) && !detectedButtons.includes(btnName)) {
        detectedButtons.push(btnName);
      }
    }

    if (detectedButtons.length > 0) {
      buttons = [...buttons, ...detectedButtons];
    }
    
    if (customPrompt.toLowerCase().includes("replace all") || customPrompt.toLowerCase().includes("remove existing")) {
      buttons = detectedButtons.length > 0 ? detectedButtons : ["AI Custom Reply"];
    } else if (customPrompt.toLowerCase().includes("remove")) {
      // Basic support for "remove button X" in preview
      const removeRegex = /remove (?:button )?["']?([^"']+)["']?/gi;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = removeRegex.exec(customPrompt)) !== null) {
        const toRemove = rMatch[1];
        buttons = buttons.filter(b => b.toLowerCase() !== toRemove.toLowerCase());
      }
    }
  }

  const finalButtons = buttons.length > 0 ? buttons : ["Standard AI Reply"];

  return {
    title: baseTitle,
    summary: {
      action: baseAction,
      custom_modifications: customPrompt || "None",
      resulting_buttons: finalButtons,
      buttonDetails: finalButtons.map(b => ({
        name: b,
        function: getButtonFunctionDescription(b, act, normCmd)
      }))
    }
  };
}

export function TelegramIntegration({
  telegramConnected,
  telegramUsername,
  botToken,
  setBotToken,
  handleConnectTelegram,
  handleDisconnectTelegram,
  botCommands,
  onSaveCommands,
}: TelegramIntegrationProps) {
  const [localCommands, setLocalCommands] = useState<BotCommand[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // AI Command Generator States
  const [aiDescription, setAiDescription] = useState("");
  const [isGeneratingCommands, setIsGeneratingCommands] = useState(false);
  const [optimizedOutput, setOptimizedOutput] = useState("");
  const [suggestedCommands, setSuggestedCommands] = useState<BotCommand[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleGenerateCommands = async () => {
    if (!aiDescription.trim()) return;
    setIsGeneratingCommands(true);
    const toastId = toast.loading("AI is analyzing your shop profile & preparing bot commands...");
    try {
      const response = await api.post("/integrations/telegram/generate-commands", {
        description: aiDescription.trim()
      });
      setOptimizedOutput(response.optimizedDescription || "");
      
      const parsedCommands = (response.commands || []).map((c: any) => ({
        command: c.command,
        description: c.description,
        action: c.action || "none",
        customReplyText: c.customReplyText || "",
        behaviorMode: c.behaviorMode || "append",
        lastCompiledReply: ""
      }));
      
      setSuggestedCommands(parsedCommands);
      setShowSuggestions(true);
      toast.success("AI suggested commands ready! Review and apply them below.", { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to generate suggested commands", { id: toastId });
    } finally {
      setIsGeneratingCommands(false);
    }
  };

  const handleApplySuggestedCommands = () => {
    if (suggestedCommands.length === 0) return;
    setLocalCommands(suggestedCommands);
    setShowSuggestions(false);
    toast.success("Suggested commands applied to your editor! Click Save & Sync to sync with Telegram.");
  };

  // Sync state whenever botCommands prop updates
  useEffect(() => {
    if (botCommands && botCommands.length > 0) {
      setLocalCommands(botCommands.map(c => {
        let act = c.action || "none";
        const normCmd = (c.command || "").toLowerCase().trim();
        if (act === "none") {
          if (normCmd === "start") act = "start";
          else if (normCmd === "menu") act = "view_menu";
          else if (normCmd === "help") act = "transfer_human";
          else if (normCmd === "clear") act = "clear_cart";
        }
        return {
          command: c.command,
          description: c.description,
          action: act,
          customReplyText: c.customReplyText || "",
          behaviorMode: c.behaviorMode || "append",
          lastCompiledReply: c.lastCompiledReply || ""
        };
      }));
    } else {
      setLocalCommands([
        { command: "start", description: "Start the bot", action: "start", customReplyText: "", behaviorMode: "append" },
        { command: "help", description: "Get support", action: "transfer_human", customReplyText: "", behaviorMode: "append" },
      ]);
    }
  }, [botCommands]);

  const handleAddCommand = () => {
    setLocalCommands([...localCommands, { command: "newcommand", description: "Description here", action: "none", customReplyText: "", behaviorMode: "append" }]);
  };

  const handleRemoveCommand = (index: number) => {
    const updated = localCommands.filter((_, i) => i !== index);
    setLocalCommands(updated);
  };

  const handleChangeCommand = (index: number, field: keyof BotCommand, value: string) => {
    const updated = [...localCommands];
    let processedValue = value;
    if (field === "command") {
      // enforce lowercase alphanumeric with underscores, up to 32 chars
      processedValue = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
      
      // Auto-assign action for convenience if they rename to a well-known command
      let autoAction = "none";
      if (processedValue === "start") autoAction = "start";
      else if (processedValue === "menu" || processedValue === "catalog") autoAction = "view_menu";
      else if (processedValue === "help" || processedValue === "support") autoAction = "transfer_human";
      else if (processedValue === "clear" || processedValue === "reset") autoAction = "clear_cart";

      updated[index] = { 
        ...updated[index], 
        command: processedValue,
        action: autoAction 
      };
    } else {
      updated[index] = { ...updated[index], [field]: processedValue };
    }
    setLocalCommands(updated);
  };

  const handleSync = async () => {
    setIsSaving(true);
    try {
      await onSaveCommands(localCommands);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-6" id="telegram-integration-section">
      <div className="flex justify-between items-center border-b pb-3">
        <div>
          <h2 className="text-lg font-semibold">
            Telegram Bot Settings
          </h2>
          <p className="text-xs text-slate-500">
            Configure bot credentials and custom menu commands
          </p>
        </div>
        {telegramConnected && (
          <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
            Active
          </span>
        )}
      </div>

      {/* BOT CONNECTION SECTION */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700">Bot Connection</h3>
        {!telegramConnected ? (
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <button
              id="btn-connect-telegram"
              onClick={handleConnectTelegram}
              disabled={!botToken}
              className={`bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium ${!botToken ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}`}
            >
              Connect Bot
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center bg-green-50/50 p-4 rounded-xl border border-green-100">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full text-green-600 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.17 2.06c.36-.08.73.13.84.48.06.19.03.39-.08.55L11.54 18.5l-6-3.8 2.5-1.55L19.42 3.12a.6.6 0 0 1 1.75-1.06zM2 12v3l5 3v-3H2z" /></svg>
              </div>
              <div>
                <p className="font-semibold text-green-950">
                  {telegramUsername ? `@${telegramUsername}` : "Connected"}
                </p>
                <p className="text-xs text-green-700">
                  Online & listening for webhooks
                </p>
              </div>
            </div>

            <button
              id="btn-disconnect-telegram"
              onClick={handleDisconnectTelegram}
              className="text-red-500 text-sm hover:underline hover:text-red-600 px-3 py-1.5 bg-white border border-red-100 rounded-lg shadow-sm"
            >
              Disconnect Bot
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Obtain your token by messaging <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-0.5">@BotFather<svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a> inside Telegram.
        </p>
      </div>


      {/* BOT COMMANDS SECTION */}
      <div className="border-t pt-5 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Custom Bot Commands
            </h3>
            <p className="text-xs text-slate-500">
              Customize the list of slash commands shown in the Telegram slash menu button.
            </p>
          </div>
          <button
            onClick={handleAddCommand}
            className="text-xs bg-slate-100 border border-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-200 inline-flex items-center gap-1 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Command
          </button>
        </div>

        {/* AI AUTO-TAILOR TELEGRAM BOT COMMANDS PROFILE */}
        <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/30 p-5 rounded-2xl border border-indigo-100/80 space-y-4 shadow-sm" id="ai-commands-tailor-panel">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl mt-0.5 shrink-0 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>⚡ AI Auto-Generator & Profile Optimizer</span>
                <span className="text-[9px] bg-indigo-600 text-white font-semibold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">Active Smart suggestions</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                Explain your shop setup, your daily timing, what you focus on, or special discounts/campaigns in plain English. AI will optimize your pitch and generate a tailored set of interactive Telegram Bot Commands instantly!
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              placeholder="Ex: We are an artisanal pizza shop named Pizza & Co, open from 4 PM - 11 PM. Our bestseller is the Truffle Truff. We want a helper command to explain our Tuesday buy-one-get-one deals, and another command where readers can claim a 10% first-order voucher."
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              rows={3}
              className="w-full border border-indigo-100 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-200 outline-none leading-relaxed placeholder-slate-400 shadow-inner"
            />
            <div className="flex justify-end pr-1">
              <button
                onClick={handleGenerateCommands}
                disabled={isGeneratingCommands || !aiDescription.trim()}
                className="bg-indigo-600 text-white font-bold text-xs px-4.5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 shadow transition-all inline-flex items-center gap-1.5 active:scale-95 disabled:active:scale-100"
              >
                {isGeneratingCommands ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Auto-Configuring Bot Actions...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13 7H7v6h6V7z" />
                      <path fillRule="evenodd" d="M5 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V5a3 3 0 00-3-3H5zm0 2h10a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Generate Custom Commands with AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI OUTPUT SUGGESTIONS DRAWER */}
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white border border-indigo-100/80 rounded-xl p-4.5 space-y-4 overflow-hidden shadow-inner mt-2"
              >
                {optimizedOutput && (
                  <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-50 text-xs text-slate-700 leading-relaxed space-y-1">
                    <span className="font-bold text-indigo-700 block uppercase tracking-wider text-[9px] font-mono">🌟 Optimized Shop Pitch / Intro Memo:</span>
                    <p className="italic font-medium text-slate-800">"{optimizedOutput}"</p>
                  </div>
                )}

                <div className="space-y-3">
                  <span className="font-bold text-slate-700 text-xs block uppercase tracking-wider font-mono">Suggested Command Set structure:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestedCommands.map((sc, i) => (
                      <div key={i} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40 hover:border-indigo-100/50 transition">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="font-mono font-bold text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100">
                            /{sc.command}
                          </span>
                          <span className="text-[9px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
                            {(sc.action || "none") === "none" ? "AI response" : (sc.action || "").replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-800 mb-1 truncate">{sc.description}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-2">
                          {sc.customReplyText || "Defaults to baseline AI knowledge answers."}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="px-4 py-2 text-xs text-slate-500 font-semibold hover:text-slate-700 transition"
                  >
                    Discard Suggestions
                  </button>
                  <button
                    onClick={handleApplySuggestedCommands}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition"
                  >
                    Accept & Apply All Commands
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* COMMANDS LIST */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
          {localCommands.map((item, index) => {
            const sysBehavior = getCommandSystemBehavior(item);
            const isBuiltIn = ["start", "menu", "catalog", "help", "support", "clear", "reset"].includes(item.command || "");

            return (
              <div key={index} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden" id={`command-card-${index}`}>
                {/* Header: Command Identity */}
                <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-bold text-base">/</span>
                      <input
                        type="text"
                        placeholder="start"
                        value={item.command}
                        onChange={(e) => handleChangeCommand(index, "command", e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm font-mono font-bold text-slate-900 p-0 w-28 uppercase tracking-tight"
                      />
                    </div>
                    {isBuiltIn && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-blue-200">
                        System Core
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveCommand(index)}
                    disabled={localCommands.length <= 1}
                    className="text-slate-300 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 disabled:opacity-30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Body: Configuration & Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  {/* Left: Configuration Inputs (8 cols) */}
                  <div className="lg:col-span-7 p-5 space-y-4 border-r border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Menu Description</label>
                        <input
                          type="text"
                          placeholder="Starts the shop assistant bot"
                          value={item.description}
                          onChange={(e) => handleChangeCommand(index, "description", e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-sm bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Customization Mode</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                          <button
                            onClick={() => handleChangeCommand(index, "behaviorMode", "append")}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${ (item.behaviorMode || "append") === "append" ? "bg-white shadow-sm text-blue-600 border border-blue-50" : "text-slate-400 hover:text-slate-600 border border-transparent" }`}
                            title="Keep default system buttons and just add your custom text"
                          >
                            Enhance Default
                          </button>
                          <button
                            onClick={() => handleChangeCommand(index, "behaviorMode", "override")}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${ item.behaviorMode === "override" ? "bg-white shadow-sm text-amber-600 border border-amber-50" : "text-slate-400 hover:text-slate-600 border border-transparent" }`}
                            title="Remove all default system logic and output ONLY your text"
                          >
                            Full Override
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-widest flex items-center justify-between">
                        <span>🤖 AI Custom Instructions & Prompt</span>
                        <span className="text-[9px] font-semibold text-indigo-500 italic bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">Powered by Groq Agent</span>
                      </label>
                      <textarea
                        placeholder={
                          item.action === "start" 
                            ? "E.g.: 'Always mention our 10% Sunday discount and add a button for \"Today's Specials\"'"
                            : "Tell the AI exactly how to respond or what extra buttons to show..."
                        }
                        value={item.customReplyText || ""}
                        onChange={(e) => handleChangeCommand(index, "customReplyText", e.target.value)}
                        rows={3}
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-blue-500 placeholder-slate-300 resize-none leading-relaxed shadow-sm"
                      />
                    </div>

                    {/* COLLAPSIBLE FUNCTION REFERENCE */}
                    <div className="pt-2">
                       <details className="group border rounded-xl overflow-hidden bg-slate-50 border-slate-200 transition-all">
                          <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none hover:bg-slate-100">
                             <div className="flex items-center gap-2">
                                <span className="bg-slate-200 text-slate-600 p-1 rounded transition-transform group-open:rotate-180">
                                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                   Command Function & Layout Reference
                                </span>
                             </div>
                             <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                                {sysBehavior.summary.buttonDetails.length} Options Found
                             </span>
                          </summary>
                          <div className="p-0 border-t border-slate-200">
                             <table className="w-full text-left text-[10px] border-collapse bg-white">
                                <thead>
                                   <tr className="bg-slate-50/50 border-b border-slate-100">
                                      <th className="px-3 py-1.5 font-bold text-slate-400 uppercase w-1/3">Option / Button</th>
                                      <th className="px-3 py-1.5 font-bold text-slate-400 uppercase">Triggered Function & Logic</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                   {sysBehavior.summary.buttonDetails.map((bd, i) => (
                                      <tr key={i} className="hover:bg-slate-50/30">
                                         <td className="px-3 py-2 font-bold text-indigo-600 whitespace-nowrap">
                                            {bd.name}
                                         </td>
                                         <td className="px-3 py-2 text-slate-500 leading-normal">
                                            {bd.function}
                                         </td>
                                      </tr>
                                   ))}
                                   {sysBehavior.summary.buttonDetails.length === 0 && (
                                      <tr>
                                         <td colSpan={2} className="px-3 py-4 text-center text-slate-400 italic">
                                            No interactive buttons configured for this command yet.
                                         </td>
                                      </tr>
                                   )}
                                </tbody>
                             </table>
                          </div>
                       </details>
                    </div>
                  </div>

                  {/* Right: Visual Preview (4 cols) */}
                  <div className="lg:col-span-5 bg-slate-50/30 p-5 flex flex-col justify-center border-t lg:border-t-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Visual Message Preview</div>
                    
                    <div className="w-full max-w-[280px] mx-auto bg-[#8bb4d4] p-3 rounded-2xl shadow-inner min-h-[220px] flex flex-col gap-2 border-4 border-slate-200">
                      {/* Telegram UI Bubble */}
                      <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-sm text-[13px] leading-snug text-slate-800 relative max-w-[90%]">
                        <div className="font-semibold text-[11px] text-blue-600 mb-1 leading-none uppercase tracking-tighter">Bot Assistant</div>
                        {item.customReplyText ? (
                          <div className="italic text-slate-500 whitespace-pre-wrap">{item.customReplyText}</div>
                        ) : (
                          <div>{sysBehavior.summary.action}...</div>
                        )}
                        <div className="text-[9px] text-slate-400 text-right mt-1 font-mono">10:42 AM</div>
                        
                        {/* Little triangle tail for bubble */}
                        <div className="absolute top-0 -left-1 w-2 h-2 bg-white transform rotate-45"></div>
                      </div>

                      {/* Mockup Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {sysBehavior.summary.resulting_buttons.map((btn, i) => (
                          <div key={i} className="bg-white/95 border border-blue-100 py-2 rounded-lg text-center text-[11px] font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50 cursor-default select-none truncate px-1">
                            {btn}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.behaviorMode === "override" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {item.behaviorMode === "override" ? "● PLAIN TEXT OVERRIDE" : "● AI ENHANCED FLOW"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>



        {/* Telegram Cache Notice */}
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex gap-2">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <div>
            <h4 className="text-xs font-semibold text-amber-900">Telegram Command Caching Alert</h4>
            <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
              Telegram aggressively caches command menus locally on user devices. After synchronization, you or your customers might need to close/re-open their Telegram application or search and restart a chat session to experience the command listing updates instantly.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSync}
            disabled={isSaving}
            className="bg-slate-900 text-white font-medium px-5 py-2 rounded-xl text-sm hover:bg-slate-800 focus:outline-none transition inline-flex items-center gap-1.5 select-none disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4"></path>
                </svg>
                Save & Sync Commands
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
