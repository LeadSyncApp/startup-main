import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, MessageSquare, ShoppingBag, Store } from "lucide-react";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./features/auth-tenancy/AuthContext";
import { Toaster } from "react-hot-toast";
import { MasterDashboardLayout, TabID } from "./components/layouts/MasterDashboardLayout";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { SignInForm } from "./components/auth/SignInForm";
import { SimulationController } from "./simulation/SimulationController";

import { AutoRepliesPage } from "./features/configurations/AutoRepliesPage";
import { CustomerList } from "./features/audience-crm/CustomerList";
import { BroadcastEngine } from "./features/broadcast/BroadcastEngine";
import { OrderFulfillmentBoard } from "./features/orders/OrderFulfillmentBoard";
import { DailyCollectionStats } from "./features/dashboard/DailyCollectionStats";
import { DailyPulseAdaptiveWidget } from "./features/dashboard/DailyPulseAdaptiveWidget";
import { ConfigurationsPage } from "./features/configurations/ConfigurationsPage";
import { AcceptInvitePage } from "./features/team/AcceptInvitePage";
import { activityToast as toast } from "./features/activity-ledger/useActivityStore";
import { IntelligentButton } from "./components/IntelligentButton";
import { Card, CardHeader } from "./components/ui";
import { GuidedTour } from "./components/tour/GuidedTour";
import { Users, Plus, Mail, X } from "lucide-react";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, logout, isPendingOnboarding, pendingToken, completeOnboarding } = useAuth();

  // Onboarding state
  const [firstName, setFirstName] = useState("Rahul");
  const [lastName, setLastName] = useState("Verma");
  const [mockEmail, setMockEmail] = useState("rahul@omsaiboutique.in");
  const [mockCompany, setMockCompany] = useState("Om Sai Silk Boutique");
  const [phone, setPhone] = useState("9876543210");
  const [password, setPassword] = useState("");
  const [, setBusinessScale] = useState<"HOME" | "SME">("HOME");
  const [, setBusinessType] = useState("Retailer");
  const [dailyRevenueTarget, setDailyRevenueTarget] = useState("5000");
  const [, setTrackInventory] = useState(true);
  const [, setChannelVerified] = useState({ telegram: false, whatsapp: false });
  const [, setShouldShake] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<"PAPER" | "SPREADSHEET" | "CRM">("PAPER");
  const [invitedMembers, setInvitedMembers] = useState<string[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [inputError, setInputError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error === "NO_ACCOUNT") {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Active tab state - now using new TabID values
  const [activeTab, setActiveTab] = useState<TabID>("shop");

  // Auth-based route guard
  const lastHandledPathRef = useRef<string | null>(null);
  const syncUrl = useCallback(() => {
    const path = location.pathname;
    if (lastHandledPathRef.current === path) return;
    lastHandledPathRef.current = path;
    if (user) {
      if (path === "/login" || path === "/onboarding" || path === "/auth-callback" || path === "/") {
        navigate("/", { replace: true });
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

  // Redirect STAFF to messages
  useEffect(() => {
    if (user) {
      if (user.role === 'STAFF' && activeTab === 'shop') {
        setActiveTab('messages');
      }
    }
  }, [user, activeTab]);

  const handleGoogleOnboardingComplete = async (data: any) => {
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
      toast.success(`Workspace ready for ${mockCompany}!`);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleOnboardingComplete = async (data: any) => {
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
      toast.success(`System ready for ${mockCompany}!`);
    } catch (err: any) { toast.error(err.message); }
  };

  const isGoogleOnboarding = isPendingOnboarding && !!pendingToken;

  // Simplified dashboard home ("My Shop") content
  const renderShopHome = () => (
    <motion.div
      key="shop-tab"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Daily Stats */}
      <DailyCollectionStats />

      {/* Quick actions grid for new users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="quick-actions">
        <Card hover padding="md" className="text-center">
          <div className="h-10 w-10 rounded-xl bg-brand-saffron-soft text-brand-saffron flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--app-text)' }}>Reply to Messages</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>Chat with customers</p>
        </Card>
        <Card hover padding="md" className="text-center">
          <div className="h-10 w-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--app-text)' }}>View Orders</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>Track & fulfill</p>
        </Card>
        <Card hover padding="md" className="text-center">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--app-text)' }}>Customers</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>View your list</p>
        </Card>
        <Card hover padding="md" className="text-center">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Zap className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--app-text)' }}>Broadcast</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>Send offers</p>
        </Card>
      </div>

      {/* Today's Pulse */}
      <Card padding="lg" data-tour="todays-activity">
        <CardHeader
          title="Today's Activity"
          subtitle="Real-time updates from your shop"
        />
        <DailyPulseAdaptiveWidget dailyRevenueTarget={dailyRevenueTarget}>
          <div className="h-40 flex items-end gap-3 justify-between mt-4">
            {[40, 70, 45, 90, 65, 80, 50, 40].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div
                  className="w-full bg-app-bg-soft rounded-lg group-hover:bg-brand-saffron-soft transition-all"
                  style={{ height: `${h}%` }}
                />
                <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>{i+9}:05</span>
              </div>
            ))}
          </div>
        </DailyPulseAdaptiveWidget>
      </Card>

      {/* Migration / Getting Started Card */}
      <Card padding="lg" data-tour="getting-started">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-brand-navy text-white flex items-center justify-center shrink-0">
            <Store className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base" style={{ color: 'var(--app-text)' }}>
              {currentWorkflow === "PAPER" 
                ? "Start your digital journey" 
                : currentWorkflow === "SPREADSHEET" 
                  ? "Import your spreadsheet" 
                  : "Connect your current system"}
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>
              {currentWorkflow === "PAPER" 
                ? "Move from pen and paper to digital. Log your first customer today."
                : currentWorkflow === "SPREADSHEET" 
                  ? "Upload your Excel or Sheets file and we'll map everything automatically."
                  : "Sync your existing data from other tools."}
            </p>
          </div>
          <IntelligentButton
            onAsyncClick={async () => {
              await new Promise(resolve => setTimeout(resolve, 800));
              toast.success("Getting started guide opened!");
              return true;
            }}
            successText="Done!"
            className="btn-primary text-sm whitespace-nowrap"
          >
            Get Started
          </IntelligentButton>
        </div>
      </Card>

      {/* Team Invite */}
      <Card padding="lg">
        <CardHeader
          title="Invite Team Members"
          subtitle="Add family, staff or partners to help manage"
          action={<span className="text-2xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: 'var(--app-bg-soft)', color: 'var(--app-text-muted)' }}>Optional</span>}
        />
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--app-text-muted)' }} />
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => { setNewMemberEmail(e.target.value); if (inputError) setInputError(false); }}
              placeholder="partner@mybusiness.com"
              className="input-field pl-9"
            />
          </div>
          <IntelligentButton
            onAsyncClick={async () => {
              await new Promise(resolve => setTimeout(resolve, 800));
              if (!newMemberEmail.includes("@")) {
                setInputError(true); setShouldShake(true);
                setTimeout(() => setShouldShake(false), 650);
                toast.error("Please enter a valid email.");
                return false;
              }
              if (invitedMembers.includes(newMemberEmail)) {
                setInputError(true); setShouldShake(true);
                setTimeout(() => setShouldShake(false), 650);
                toast.error("Already invited!");
                return false;
              }
              setInvitedMembers([...invitedMembers, newMemberEmail]);
              toast.success(`Invite sent to ${newMemberEmail}!`);
              setNewMemberEmail("");
              return true;
            }}
            successText="Sent!"
            className="btn-saffron text-sm"
          >
            <Plus className="h-4 w-4" /> Invite
          </IntelligentButton>
        </div>
        {invitedMembers.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {invitedMembers.map((email, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--app-bg-soft)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{email}</span>
                <div className="flex items-center gap-2">
                  <span className="badge-warning text-2xs">Pending</span>
                  <button onClick={() => setInvitedMembers(invitedMembers.filter((_, i) => i !== idx))} className="cursor-pointer" style={{ color: 'var(--app-text-muted)' }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );

  return (
    <div className="w-full font-sans antialiased">
      <Toaster position="top-center" />
      <SimulationController onNavigate={setActiveTab} />
      <Routes>
        <Route path="/login" element={
          !user ? (
            <SignInForm
              onSuccess={(userData, companyData, token) => {
                setMockCompany(companyData.name);
                login(userData, companyData, token);
              }}
              onSwitchToSignup={() => navigate("/onboarding", { replace: true })}
            />
          ) : (
            <Navigate to="/" replace />
          )
        } />
        <Route path="/onboarding" element={
          !user ? (
            <OnboardingWizard
              onComplete={isGoogleOnboarding ? handleGoogleOnboardingComplete : handleOnboardingComplete}
              onSwitchToSignIn={() => navigate("/login", { replace: true })}
              firstName={firstName} setFirstName={setFirstName}
              lastName={lastName} setLastName={setLastName}
              mockEmail={mockEmail} setMockEmail={setMockEmail}
              mockCompany={mockCompany} setMockCompany={setMockCompany}
              phone={phone} setPhone={setPhone}
              password={password} setPassword={setPassword}
              skipStep1={isGoogleOnboarding}
            />
          ) : (
            <Navigate to="/" replace />
          )
        } />
        <Route path="/" element={
          user ? (
            <MasterDashboardLayout
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              userRole={user.role}
              merchantName={mockCompany}
              onLogout={logout}
            >
              <div className="w-full">
                <GuidedTour activeTab={activeTab} />
                <AnimatePresence mode="wait">
                  {activeTab === 'shop' && renderShopHome()}
                  {activeTab === 'messages' && (
                    <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-tour="messages-panel">
                      <div className="flex items-center justify-center h-[640px] text-slate-400">
                        <p className="text-sm font-medium">Messages module removed.</p>
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'automation' && (
                    <motion.div key="automation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-tour="automation-builder">
                      <AutoRepliesPage />
                    </motion.div>
                  )}
                  {activeTab === 'customers' && (
                    <motion.div key="customers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-tour="customers-list">
                      <CustomerList />
                    </motion.div>
                  )}
                  {activeTab === 'broadcast' && (
                    <motion.div key="broadcast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-tour="broadcast-engine">
                      <BroadcastEngine />
                    </motion.div>
                  )}
                  {activeTab === 'orders' && (
                    <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-tour="orders-board">
                      <OrderFulfillmentBoard />
                    </motion.div>
                  )}
                  {activeTab === 'settings' && (
                    <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-tour="settings-page">
                      <ConfigurationsPage />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
            <Navigate to="/" replace />
          )
        } />
        <Route path="*" element={<Navigate to={user ? "/" : "/onboarding"} replace />} />
      </Routes>
    </div>
  );
}