import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation, useParams, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./features/auth-tenancy/AuthContext";
import { Toaster, toast } from "react-hot-toast";
import { MasterDashboardLayout, TabID } from "./components/layouts/MasterDashboardLayout";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { SignInForm } from "./components/auth/SignInForm";
import { connectSocket, disconnectSocket, onNotification } from "./lib/socketClient";
import { useNotificationStore } from "./features/notifications/useNotificationStore";
import { AcceptInvitePage } from "./features/team/AcceptInvitePage";
import MarketingHomePage from "./pages/MarketingHomePage";
import { activityToast as activityToast } from "./features/activity-ledger/useActivityStore";
import { GuidedTour } from "./components/tour/GuidedTour";
import { WizardProvider } from "./contexts/WizardContext";
import { X } from "lucide-react";

const AutoRepliesPage = lazy(() => import("./features/configurations/AutoRepliesPage").then(m => ({ default: m.AutoRepliesPage })));
const CustomerList = lazy(() => import("./features/audience-crm/CustomerList").then(m => ({ default: m.CustomerList })));
const BroadcastEngine = lazy(() => import("./features/broadcast/BroadcastEngine").then(m => ({ default: m.BroadcastEngine })));
const OrderFulfillmentBoard = lazy(() => import("./features/orders/OrderFulfillmentBoard").then(m => ({ default: m.OrderFulfillmentBoard })));
const StreamTriage = lazy(() => import("./features/stream-triage/StreamTriage").then(m => ({ default: m.StreamTriage })));
const InboxSplitView = lazy(() => import("./features/inbox/InboxSplitView"));
const InventoryPage = lazy(() => import("./features/inventory/InventoryPage").then(m => ({ default: m.InventoryPage })));
const MyShopPage = lazy(() => import("./features/dashboard/MyShopPage").then(m => ({ default: m.MyShopPage })));
const ConfigurationsPage = lazy(() => import("./features/configurations/ConfigurationsPage").then(m => ({ default: m.ConfigurationsPage })));
const StaffProfilePage = lazy(() => import("./features/staff/StaffProfilePage").then(m => ({ default: m.StaffProfilePage })));

// NOTE FOR REVIEW: InboxSplitWithParam reads the :leadId URL param and passes it
// as initialLeadId to InboxSplitView. This preserves deep-link / notification
// behavior for /inbox/:leadId routes while rendering inside the split view.
function InboxSplitWithParam() {
  const { leadId } = useParams<{ leadId: string }>();
  return <InboxSplitView initialLeadId={leadId} />;
}

const VALID_TABS: TabID[] = ["shop", "messages", "inbox", "customers", "broadcast", "orders", "automation", "inventory", "settings", "profile"];

function getInitialTab(): TabID {
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as TabID;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      return tabParam;
    }
    const saved = localStorage.getItem("leadsync_active_tab") as TabID;
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch {
    // fallback
  }
  return "shop";
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, company, token, login, logout, isPendingOnboarding, pendingToken, completeOnboarding } = useAuth();

  // Onboarding state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mockEmail, setMockEmail] = useState("");
  const [mockCompany, setMockCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [, setBusinessScale] = useState<"HOME" | "SME">("HOME");
  const [businessType, setBusinessType] = useState("Retailer");
  const [, setDailyRevenueTarget] = useState("5000");
  const [, setTrackInventory] = useState(true);
  const [, setChannelVerified] = useState({ telegram: false, whatsapp: false });
  const [, setCurrentWorkflow] = useState<"PAPER" | "SPREADSHEET" | "CRM">("PAPER");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error === "NO_ACCOUNT") {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Active tab state - synced with URL search param ?tab= and localStorage
  const [activeTab, setActiveTab] = useState<TabID>(getInitialTab);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab") as TabID;
    if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search, activeTab]);

  const handleTabChange = useCallback((tabId: TabID) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem("leadsync_active_tab", tabId);
    } catch {}
    if (location.pathname === "/dashboard") {
      navigate(`/dashboard?tab=${tabId}`, { replace: true });
    } else {
      navigate(`/dashboard?tab=${tabId}`);
    }
  }, [navigate, location.pathname]);

  // Auth-based route guard
  const lastHandledPathRef = useRef<string | null>(null);
  const syncUrl = useCallback(() => {
    const path = location.pathname;
    if (lastHandledPathRef.current === path) return;
    lastHandledPathRef.current = path;
    if (user) {
      if (path === "/login" || path === "/onboarding" || path === "/auth-callback" || path === "/") {
        const targetTab = getInitialTab();
        navigate(`/dashboard?tab=${targetTab}`, { replace: true });
      }
    }
  }, [user, navigate, location.pathname]);

  // When Google signup user enters pending onboarding, navigate to /onboarding
  // using React Router's navigate so location state updates properly
  useEffect(() => {
    if (isPendingOnboarding) {
      navigate("/onboarding", { replace: true });
    }
  }, [isPendingOnboarding, navigate]);

  useEffect(() => { syncUrl(); }, [user, isPendingOnboarding, syncUrl]);

  useEffect(() => {
    const handlePopState = () => { lastHandledPathRef.current = null; };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Initialize Socket.IO connection + notification store when user is authenticated
  useEffect(() => {
    if (user && user.companyId) {
      // Set up socket notification listener before connecting
      onNotification((notification) => {
        useNotificationStore.getState().addOne(notification);
        // Show animated toast for new live notification
        toast((t) => (
          <motion.div
            initial={{ opacity: 0, x: 50, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 50, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex items-start gap-3 p-4 rounded-xl shadow-2xl border cursor-pointer max-w-sm"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: "var(--app-border)",
            }}
            onClick={() => {
              useNotificationStore.getState().addOne(notification);
              toast.dismiss(t.id);
            }}
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
                 style={{ backgroundColor: "rgba(212, 168, 67, 0.15)", color: "var(--brand-saffron)" }}>
              🔔
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider mb-0.5"
                 style={{ color: "var(--brand-saffron)" }}>
                New Notification
              </p>
              <p className="text-sm font-bold leading-tight" style={{ color: "var(--app-text)" }}>
                {notification.title}
              </p>
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--app-text-muted)" }}>
                {notification.body}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
              className="shrink-0 p-1 rounded-lg hover:bg-app-bg-soft"
              style={{ color: "var(--app-text-muted)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ), {
          duration: 5000,
          position: "top-right",
          style: { background: "transparent", boxShadow: "none", padding: 0, margin: 0 },
        });
      });

      // Connect socket (emits register_user, starts heartbeats)
      // Passes the auth token via handshake for JWT verification
      connectSocket(user.id, user.companyId, token ?? "", user.name || user.firstName);

      // Fetch initial notification history
      useNotificationStore.getState().fetch();
    }

    return () => {
      disconnectSocket();
    };
  }, [user?.id, user?.companyId]);

  const handleGoogleOnboardingComplete = useCallback(async (data: any) => {
    try {
      setBusinessScale(data.businessScale);
      setBusinessType(data.businessType);
      setDailyRevenueTarget(data.dailyRevenueTarget);
      setTrackInventory(data.trackInventory);
      setChannelVerified(data.channels);
      setCurrentWorkflow(data.currentWorkflow);
      const response = await fetch("/api/auth/complete-google-onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pendingToken}` },
        body: JSON.stringify({ companyName: mockCompany, businessScale: data.businessScale, businessType: data.businessType, currentWorkflow: data.currentWorkflow }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to complete onboarding");
      const meRes = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${pendingToken}` } });
      if (!meRes.ok) throw new Error("Failed to fetch user data");
      const meData = await meRes.json();
      completeOnboarding(meData.user, meData.company);
      setMockCompany(data.companyName || mockCompany);
      activityToast.success(`Workspace ready for ${mockCompany}!`);
    } catch (err: any) { activityToast.error(err.message); }
  }, [pendingToken, mockCompany, completeOnboarding, activityToast]);

  const handleOnboardingComplete = useCallback(async (data: any) => {
    try {
      setBusinessScale(data.businessScale);
      setBusinessType(data.businessType);
      setDailyRevenueTarget(data.dailyRevenueTarget);
      setTrackInventory(data.trackInventory);
      setCurrentWorkflow(data.currentWorkflow);
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: mockCompany, firstName, lastName, email: mockEmail,
          password: password || "Pb123456", phone, currencyCode: "INR", currencySymbol: "₹", timezone: "Asia/Kolkata",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Registration failed");
      login(result.user, result.company, result.token || "mock_access_jwt_token_leadsync_secure");
      activityToast.success(`System ready for ${mockCompany}!`);
    } catch (err: any) { activityToast.error(err.message); }
  }, [mockCompany, firstName, lastName, mockEmail, password, phone, login, activityToast]);

  const isGoogleOnboarding = isPendingOnboarding && !!pendingToken;

  const signInOnSuccess = useCallback((userData: any, companyData: any, token: string) => {
    setMockCompany(companyData.name);
    login(userData, companyData, token);
  }, [login]);

  const switchToSignup = useCallback(() => {
    navigate("/onboarding", { replace: true });
  }, [navigate]);

  const switchToSignIn = useCallback(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  // Dashboard home ("My Shop") content
  const shopHome = (
    <div className="space-y-6">
      <MyShopPage onNavigate={handleTabChange} />
    </div>
  );

  return (
    <div className="w-full font-sans antialiased">
      <Toaster position="top-center" />
      <Routes>
        <Route path="/login" element={
          !user ? (
            <SignInForm
              onSuccess={signInOnSuccess}
              onSwitchToSignup={switchToSignup}
            />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } />
        <Route path="/onboarding" element={
          !user ? (
            <OnboardingWizard
              onComplete={isGoogleOnboarding ? handleGoogleOnboardingComplete : handleOnboardingComplete}
              onSwitchToSignIn={switchToSignIn}
              firstName={firstName} setFirstName={setFirstName}
              lastName={lastName} setLastName={setLastName}
              mockEmail={mockEmail} setMockEmail={setMockEmail}
              mockCompany={mockCompany} setMockCompany={setMockCompany}
              phone={phone} setPhone={setPhone}
              password={password} setPassword={setPassword}
              skipStep1={isGoogleOnboarding}
            />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } />
        <Route path="/" element={<MarketingHomePage />} />
        <Route path="/dashboard" element={
          user ? (
            <MasterDashboardLayout
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              userRole={user.role}
              merchantName={company?.name || mockCompany || "My Business"}
              onLogout={logout}
            >
              <WizardProvider>
              <div className="w-full h-full min-h-0 flex flex-col">
                <GuidedTour activeTab={activeTab} />
                <Suspense fallback={
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--brand-saffron)", borderTopColor: "transparent" }} />
                      <p className="text-xs font-medium" style={{ color: "var(--app-text-muted)" }}>Loading...</p>
                    </div>
                  </div>
                }>
                <AnimatePresence mode="wait">
                  {activeTab === 'shop' && shopHome}
                  {activeTab === 'messages' && (
                    <motion.div key="messages" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="messages-panel">
                      <StreamTriage />
                    </motion.div>
                  )}
                  {activeTab === 'inbox' && (
                    <motion.div key="inbox" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="inbox-panel" className="flex-1 min-h-0">
                      <InboxSplitView />
                    </motion.div>
                  )}
                  {activeTab === 'automation' && (
                    <motion.div key="automation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="automation-builder">
                      <AutoRepliesPage />
                    </motion.div>
                  )}

                  {activeTab === 'customers' && (
                    <motion.div key="customers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="customers-list">
                      <CustomerList />
                    </motion.div>
                  )}
                  {activeTab === 'broadcast' && (
                    <motion.div key="broadcast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="broadcast-engine">
                      <BroadcastEngine />
                    </motion.div>
                  )}
                  {activeTab === 'orders' && (
                    <motion.div key="orders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="orders-board">
                      <OrderFulfillmentBoard />
                    </motion.div>
                  )}
                  {activeTab === 'settings' && (
                    <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="settings-page">
                      <ConfigurationsPage />
                    </motion.div>
                  )}
                  {activeTab === 'inventory' && (
                    <motion.div key="inventory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="inventory-page">
                      <InventoryPage companyId={user?.companyId} businessType={businessType} />
                    </motion.div>
                  )}
                  {activeTab === 'profile' && (
                    <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeInOut" }} data-tour="staff-profile">
                      <StaffProfilePage />
                    </motion.div>
                  )}
                </AnimatePresence>
                </Suspense>
              </div>
              </WizardProvider>
            </MasterDashboardLayout>
          ) : (
            <Navigate to="/onboarding" replace />
          )
        } />
        <Route path="/inbox/:leadId" element={
          user ? (
            <MasterDashboardLayout
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              userRole={user.role}
              merchantName={mockCompany}
              onLogout={logout}
            >
              <InboxSplitWithParam />
            </MasterDashboardLayout>
          ) : (
            <Navigate to="/onboarding" replace />
          )
        } />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/auth-callback" element={
          !user ? (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--app-bg)' }}>
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-saffron" />
            </div>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } />
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/onboarding"} replace />} />
      </Routes>
    </div>
  );
}
