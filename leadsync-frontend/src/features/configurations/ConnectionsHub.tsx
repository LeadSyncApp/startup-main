import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Globe, MessageCircle, MessageSquare, X, Check,
  Loader2, Trash2, Copy, FileCode, Shield, HelpCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../auth-tenancy/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export function ConnectionsHub() {
  const { user, company, updateCompany } = useAuth();
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [isLoadingBot, setIsLoadingBot] = useState(false);
  const [isConnectingTelegram, setIsConnectingTelegram] = useState(false);

  // Modals
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [isMetaStubModalOpen, setIsMetaStubModalOpen] = useState(false);
  const [activeMetaPlatform, setActiveMetaPlatform] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (company) {
      setTelegramConnected(!!company.telegramConnected);
      setTelegramBotUsername(company.telegramBotUsername || "");
      setWhatsAppConnected(!!company.businessType);
    }
  }, [company?.id]);

  const handleConnectTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramToken.trim()) {
      toast.error("Please enter a valid Telegram Bot Token.");
      return;
    }
    setIsConnectingTelegram(true);
    try {
      const response = await apiClient.post("/integrations/telegram/connect", {
        token: telegramToken.trim()
      });
      toast.success(response.data?.message || "Telegram Bot connected live!", { icon: "🤖" });
      updateCompany({
        telegramConnected: true,
        telegramBotUsername: response.data.botUsername
      });
      setTelegramConnected(true);
      setTelegramBotUsername(response.data.botUsername || "");
      setIsTelegramModalOpen(false);
      setTelegramToken("");
    } catch (error: any) {
      console.error("Telegram token validation error:", error);
      toast.error(error?.response?.data?.message || "Failed to connect bot. Verify the token with @BotFather.");
    } finally {
      setIsConnectingTelegram(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (user?.role !== 'OWNER' && user?.role !== 'MANAGER') {
      toast.error("You don't have permission to disconnect the bot.");
      return;
    }
    if (!window.confirm("Are you sure you want to disconnect this Telegram bot?")) return;
    setIsLoadingBot(true);
    try {
      const response = await apiClient.post("/integrations/telegram/disconnect");
      toast.success(response.data?.message || "Telegram bot disconnected gracefully.", { icon: "🔌" });
      updateCompany({ telegramConnected: false, telegramBotUsername: "" });
      setTelegramConnected(false);
      setTelegramBotUsername("");
    } catch (error: any) {
      console.error("Disconnect failure:", error);
      toast.error(error?.response?.data?.message || "Failed to gracefully clear token webhook.");
    } finally {
      setIsLoadingBot(false);
    }
  };

  const openMetaStubDialog = (platform: string) => {
    setActiveMetaPlatform(platform);
    setIsMetaStubModalOpen(true);
  };

  const handleCopySnippet = () => {
    const snippetText = `<script src="https://widget.leadsync.com/loader.js" data-tenant-id="${company?.id || 'your-workspace-tenant-id'}"></script>`;
    navigator.clipboard.writeText(snippetText);
    setCopied(true);
    toast.success("Widget snippet copied successfully!", { icon: "📋" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="rounded-[2.5rem] p-8 sm:p-10 shadow-lg text-white relative overflow-hidden group"
           style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, #0F1F33 100%)' }}>
        <div className="absolute top-0 right-0 w-[45%] h-full pointer-events-none"
             style={{ background: 'linear-gradient(to left, rgba(212, 168, 67, 0.08), transparent)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[150px] translate-y-1/3 translate-x-1/3 opacity-20 pointer-events-none"
             style={{ backgroundColor: 'var(--brand-saffron)' }} />
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: 'rgba(212, 168, 67, 0.15)', color: 'var(--brand-saffron-light)' }}>
            <Shield className="h-3 w-3" /> Secure Multi-channel Access
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-white">
            Sync Your Conversations
          </h2>
          <p className="font-medium text-base sm:text-lg leading-relaxed"
             style={{ color: 'rgba(241, 245, 249, 0.8)' }}>
            Link digital messaging channels to synchronize client chats directly into your workspace.
            Automate catalog browsing, parse checkout intents, and route leads live.
          </p>
        </div>
      </div>

      {/* Platform Connection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">

        {/* Telegram Card */}
        <Card className="p-8 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(0, 136, 204, 0.1)', color: '#0088cc', border: '1px solid rgba(0, 136, 204, 0.15)' }}>
                <Send className="h-7 w-7 stroke-[2.2] translate-x-[-1px] translate-y-[1px]" />
              </div>
              {telegramConnected ? (
                <Badge variant="success" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse mr-1.5"
                        style={{ backgroundColor: 'var(--success-green)' }} />
                  Connected
                </Badge>
              ) : (
                <Badge variant="info" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
                  Offline
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                Telegram Bot
              </h3>
              {telegramConnected && telegramBotUsername && (
                <p className="text-[11px] font-bold font-mono tracking-wider inline-block px-2.5 py-1 rounded-lg"
                   style={{ color: '#0088cc', backgroundColor: 'rgba(0, 136, 204, 0.08)' }}>
                  @{telegramBotUsername}
                </p>
              )}
              <p className="font-semibold text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Collect automatic checkouts, display structured menus, and respond in real-time using a dedicated Telegram bot.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 flex items-center justify-between gap-3"
               style={{ borderTop: '1px solid var(--app-border)' }}>
            <span className="text-[10px] font-black uppercase tracking-wider"
                  style={{ color: 'var(--app-text-muted)' }}>
              Immediate Activation
            </span>
            {telegramConnected ? (
              <Button
                variant="secondary"
                onClick={handleDisconnectTelegram}
                disabled={isLoadingBot}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.06)' }}
              >
                {isLoadingBot ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Disconnect
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setIsTelegramModalOpen(true)}
                className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
              >
                Connect
              </Button>
            )}
          </div>
        </Card>

        {/* Website Widget Card */}
        <Card className="p-8 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'var(--brand-saffron-soft)', color: 'var(--brand-saffron)', border: '1px solid rgba(212, 168, 67, 0.2)' }}>
                <Globe className="h-7 w-7 stroke-[2.2]" />
              </div>
              <Badge variant="success" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
                ⚡ Available
              </Badge>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                Website Widget
              </h3>
              <p className="font-semibold text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Deploy a live-chat snippet on Shopify, Webflow, or custom sites. Direct visitors straight into your shared inbox.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 flex items-center justify-between gap-3"
               style={{ borderTop: '1px solid var(--app-border)' }}>
            <span className="text-[10px] font-black uppercase tracking-wider"
                  style={{ color: 'var(--app-text-muted)' }}>
              SME Snippet Script
            </span>
            <Button
              variant="secondary"
              onClick={() => setIsWidgetModalOpen(true)}
              className="px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl"
            >
              <FileCode className="h-4 w-4 mr-1.5" />
              Get Snippet
            </Button>
          </div>
        </Card>

        {/* WhatsApp Card */}
        <Card className="p-8 flex flex-col justify-between opacity-85">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(37, 211, 102, 0.1)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.15)' }}>
                <MessageCircle className="h-7 w-7 stroke-[2.2]" />
              </div>
              {whatsAppConnected ? (
                <Badge variant="success" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse mr-1.5"
                        style={{ backgroundColor: 'var(--success-green)' }} />
                  Connected
                </Badge>
              ) : (
                <Badge variant="info" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
                  Coming Soon
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                WhatsApp Business
              </h3>
              <p className="font-semibold text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Scale conversions using WhatsApp API templates. Synchronize customer numbers to a unified shop workbench.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 flex items-center justify-between gap-3"
               style={{ borderTop: '1px solid var(--app-border)' }}>
            <span className="text-[10px] font-black uppercase tracking-wider"
                  style={{ color: 'var(--app-text-muted)' }}>
              Scheduled Rollout
            </span>
            <Button
              variant="secondary"
              onClick={() => openMetaStubDialog("WhatsApp API")}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg"
            >
              View Status
            </Button>
          </div>
        </Card>

        {/* Instagram Card */}
        <Card className="p-8 flex flex-col justify-between opacity-85">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(225, 48, 108, 0.1)', color: '#E1306C', border: '1px solid rgba(225, 48, 108, 0.15)' }}>
                <InstagramIcon className="h-7 w-7 stroke-[2.2]" />
              </div>
              <Badge variant="info" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
                Coming Soon
              </Badge>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                Instagram Direct
              </h3>
              <p className="font-semibold text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Trigger direct messaging flows when customers mention stories or reply to product posts.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 flex items-center justify-between gap-3"
               style={{ borderTop: '1px solid var(--app-border)' }}>
            <span className="text-[10px] font-black uppercase tracking-wider"
                  style={{ color: 'var(--app-text-muted)' }}>
              Scheduled Rollout
            </span>
            <Button
              variant="secondary"
              onClick={() => openMetaStubDialog("Instagram DM")}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg"
            >
              View Status
            </Button>
          </div>
        </Card>

        {/* Messenger Card */}
        <Card className="p-8 flex flex-col justify-between opacity-85">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(24, 119, 242, 0.1)', color: '#1877F2', border: '1px solid rgba(24, 119, 242, 0.15)' }}>
                <MessageSquare className="h-7 w-7 stroke-[2.2]" />
              </div>
              <Badge variant="info" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
                Coming Soon
              </Badge>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                Messenger Link
              </h3>
              <p className="font-semibold text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Sync page chat inquiries to the central workbench, facilitating fast checkouts on Facebook.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 flex items-center justify-between gap-3"
               style={{ borderTop: '1px solid var(--app-border)' }}>
            <span className="text-[10px] font-black uppercase tracking-wider"
                  style={{ color: 'var(--app-text-muted)' }}>
              Scheduled Rollout
            </span>
            <Button
              variant="secondary"
              onClick={() => openMetaStubDialog("Messenger Sync")}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg"
            >
              View Status
            </Button>
          </div>
        </Card>
      </div>

      {/* Telegram Token Pairing Modal */}
      <AnimatePresence>
        {isTelegramModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTelegramModalOpen(false)}
              className="absolute inset-0 backdrop-blur-md"
              style={{ backgroundColor: 'var(--app-backdrop)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-lg rounded-[2.5rem] shadow-[0_48px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col z-10"
              style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <div className="px-8 py-6 flex justify-between items-center"
                   style={{ borderBottom: '1px solid var(--app-border)', backgroundColor: 'var(--app-bg-soft)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: 'rgba(0, 136, 204, 0.1)', color: '#0088cc' }}>
                    <Send className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black" style={{ color: 'var(--app-text)' }}>Telegram Pairing</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: '#0088cc' }}>
                      Live API Webhook Binding
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsTelegramModalOpen(false)}
                        className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                        style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleConnectTelegram} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border text-xs font-medium space-y-2 leading-relaxed"
                       style={{ backgroundColor: 'rgba(0, 136, 204, 0.06)', borderColor: 'rgba(0, 136, 204, 0.1)', color: '#0369a1' }}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <HelpCircle className="h-4 w-4" /> Obtaining credentials:
                    </div>
                    <div>1. Open Telegram and search for @BotFather.</div>
                    <div>2. Send <code className="px-1 py-0.5 rounded font-mono font-black" style={{backgroundColor: 'rgba(0, 136, 204, 0.1)'}}>/newbot</code></div>
                    <div>3. Copy the HTTP API Token and paste it below.</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                      BotFather API Token
                    </label>
                    <input
                      type="text"
                      required
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder="e.g. 123456789:AAHd8H_KlsJnC7S0-u_7X"
                      className="w-full text-sm font-mono font-black rounded-2xl px-5 py-4 outline-none transition-all"
                      style={{
                        backgroundColor: 'var(--app-input-bg)',
                        border: '2px solid var(--app-border)',
                        color: 'var(--app-text)'
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 justify-end" style={{ borderTop: '1px solid var(--app-border)' }}>
                  <Button variant="secondary" type="button" onClick={() => setIsTelegramModalOpen(false)}
                          className="px-5 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl">
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isConnectingTelegram}
                          className="px-6 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl">
                    {isConnectingTelegram ? (
                      <><Loader2 className="h-4.5 w-4.5 animate-spin mr-2" /> Pairing...</>
                    ) : (
                      <><Check className="h-4.5 w-4.5 mr-2" /> Link Bot Token</>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Website Widget Dialog Modal */}
      <AnimatePresence>
        {isWidgetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWidgetModalOpen(false)}
              className="absolute inset-0 backdrop-blur-md"
              style={{ backgroundColor: 'var(--app-backdrop)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-xl rounded-[2.5rem] shadow-[0_48px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col z-10"
              style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <div className="px-8 py-6 flex justify-between items-center"
                   style={{ borderBottom: '1px solid var(--app-border)', backgroundColor: 'var(--app-bg-soft)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: 'var(--brand-saffron-soft)', color: 'var(--brand-saffron)' }}>
                    <Globe className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black" style={{ color: 'var(--app-text)' }}>Website Snippet</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5"
                       style={{ color: 'var(--brand-saffron)' }}>
                      Custom Site Integrations
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsWidgetModalOpen(false)}
                        className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                        style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <p className="font-medium text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Embed this HTML snippet into your website header. When visitors interact with the widget, messages drop into your workspace.
                </p>
                <div className="relative rounded-2xl overflow-hidden p-6 shadow-inner font-mono text-xs border"
                     style={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: 'rgba(212, 168, 67, 0.7)' }}>
                  <div className="absolute top-3 left-4 flex gap-1.5 pointer-events-none">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.8)' }} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }} />
                  </div>
                  <div className="pt-3 overflow-x-auto leading-relaxed max-w-full select-all whitespace-pre-wrap word-break">
                    {`<!-- LeadSync Interactive Client Loader -->\n<script \n  src="https://widget.leadsync.com/loader.js" \n  data-tenant-id="${company?.id || 'your-workspace-tenant-id'}"\n  defer>\n</script>`}
                  </div>
                  <button onClick={handleCopySnippet}
                          className="absolute right-3 top-3 p-2 rounded-lg transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95"
                          style={{ backgroundColor: '#1E293B', color: 'rgba(212, 168, 67, 0.7)', borderColor: '#334155' }}>
                    {copied ? (
                      <><Check className="h-4 w-4" style={{ color: 'var(--success-green)' }} /><span className="text-[10px] uppercase font-bold" style={{ color: 'var(--success-green)' }}>Copied</span></>
                    ) : (
                      <><Copy className="h-4 w-4" /><span className="text-[10px] uppercase font-bold">Copy</span></>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meta Stub Warning Modal */}
      <AnimatePresence>
        {isMetaStubModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMetaStubModalOpen(false)}
              className="absolute inset-0 backdrop-blur-md"
              style={{ backgroundColor: 'var(--app-backdrop)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-md rounded-[2.5rem] shadow-[0_48px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col z-10"
              style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <div className="px-8 py-6 flex justify-between items-center"
                   style={{ borderBottom: '1px solid var(--app-border)', backgroundColor: 'var(--app-bg-soft)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: 'var(--brand-saffron-soft)', color: 'var(--brand-saffron)' }}>
                    <MessageSquare className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black" style={{ color: 'var(--app-text)' }}>Coming Soon</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5"
                       style={{ color: 'var(--brand-saffron)' }}>
                      Integration Queue
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsMetaStubModalOpen(false)}
                        className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                        style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex gap-4 items-start p-4 rounded-2xl border text-xs leading-relaxed font-semibold"
                     style={{ backgroundColor: 'var(--brand-saffron-soft)', borderColor: 'rgba(212, 168, 67, 0.2)', color: 'var(--brand-navy)' }}>
                  <HelpCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-saffron)' }} />
                  <div>
                    The <strong>{activeMetaPlatform}</strong> direct channel integration is part of our upcoming scale rollout.
                  </div>
                </div>
                <Button variant="primary" onClick={() => setIsMetaStubModalOpen(false)}
                        className="w-full py-3.5 text-xs font-black uppercase tracking-widest rounded-xl">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}