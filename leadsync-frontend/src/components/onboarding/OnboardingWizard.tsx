import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Shield, 
  Utensils, ShoppingBag, Stethoscope, 
  Cake, Sparkles, User, 
  Target, Component, LineChart, Globe, ZapIcon,
  Eye, EyeOff, AlertTriangle, Braces
} from "lucide-react";
import { toast } from "react-hot-toast";
import { ProductFieldEditor, ProductField } from "../../features/inventory/ProductFieldEditor";

interface OnboardingWizardProps {
  onComplete: (data: any) => void;
  onSwitchToSignIn: () => void;
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  mockEmail: string;
  setMockEmail: (val: string) => void;
  mockCompany: string;
  setMockCompany: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  password?: string;
  setPassword?: (val: string) => void;
  skipStep1?: boolean;
}

export function OnboardingWizard({ 
  onComplete, 
  onSwitchToSignIn,
  firstName, 
  setFirstName, 
  lastName, 
  setLastName,
  mockEmail, 
  setMockEmail, 
  mockCompany, 
  setMockCompany, 
  phone, 
  setPhone,
  password = "",
  setPassword = () => {},
  skipStep1 = false,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(skipStep1 ? 2 : 1);
  const [accountExistsError, setAccountExistsError] = useState<string | null>(null);

  // Check for ACCOUNT_EXISTS error from Google OAuth signup redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const message = params.get("message");
    if (error === "ACCOUNT_EXISTS") {
      setAccountExistsError(message || "This Google account is already registered. Please sign in instead.");
      // Clean URL
      window.history.replaceState({}, document.title, "/onboarding");
    }
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [businessScale, setBusinessScale] = useState<"HOME" | "SME">("HOME");
  const [businessType, setBusinessType] = useState("Fashion & Retail");
  const [currentWorkflow, setCurrentWorkflow] = useState<"PAPER" | "SPREADSHEET" | "CRM">("PAPER");
  const [productFields, setProductFields] = useState<ProductField[]>([]);

  const handleNextStep1 = () => {
    if (!firstName.trim()) {
      toast.error("Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      toast.error("Please enter your last name.");
      return;
    }
    if (phone.length < 10) {
      toast.error("Please enter a valid mobile number.");
      return;
    }
    if (!mockEmail.includes("@")) {
      toast.error("Please enter a valid work email.");
      return;
    }
    if (password.length < 6) {
      toast.error("Security requirement: Password must be at least 6 characters.");
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (!mockCompany.trim()) {
      toast.error("What's your brand name? This setup requires a business identity.");
      return;
    }
    setStep(3);
  };

  const handleNextStep3 = () => {
    setStep(4);
  };

  const handleFinalize = () => {
    onComplete({
      businessScale,
      businessType,
      currentWorkflow,
      productFields,
      dailyRevenueTarget: "5000",
      trackInventory: true,
      channels: { telegram: false, whatsapp: false }
    });
  };

  return (
    <motion.div
      key="onboarding-wizard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex min-h-screen w-full bg-[var(--app-bg)]"
    >
      {/* Left Column: Dynamic Branding / Value Prop (Hidden on smaller screens) */}
      <div className="hidden lg:flex w-[45%] flex-col justify-between p-12 lg:p-16 relative overflow-hidden bg-[var(--app-surface)] text-[var(--app-text)]">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, var(--brand-saffron) 0%, transparent 70%)', opacity: 0.15 }} />
          <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, var(--brand-saffron) 0%, transparent 70%)', opacity: 0.08 }} />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-teal-500/20">
            <ZapIcon className="h-5 w-5 fill-current text-white" />
          </div>
          <div>
            <span className="font-black tracking-tight text-xl text-[var(--app-text)]">LeadSync</span>
            <span className="text-[10px] font-bold ml-2 uppercase tracking-widest px-2 py-0.5 rounded-full border text-[var(--brand-saffron)]" style={{ backgroundColor: 'var(--brand-saffron-soft)', borderColor: 'var(--brand-saffron)', opacity: 0.8 }}>Sandbox</span>
          </div>
        </div>

        <div className="relative z-10 space-y-12">
          {step === 1 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-[var(--app-text-muted)]" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
                  <User className="w-3.5 h-3.5" /> Workspace Identity
                </div>
                <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight text-[var(--app-text)]">
                  Welcome.<br/>Let's configure your command center.
                </h1>
                <p className="text-lg leading-relaxed max-w-md text-[var(--app-text-muted)]">
                  Establish your secure administration seat to begin orchestrating leads, dispatch queues, and customer relations.
                </p>
             </motion.div>
          )}

          {step === 2 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-[var(--app-text-muted)]" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
                  <Component className="w-3.5 h-3.5" /> Merchant DNA
                </div>
                <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight text-[var(--app-text)]">
                  What are we<br/>building today?
                </h1>
                <p className="text-lg leading-relaxed max-w-md text-[var(--app-text-muted)]">
                  Whether you're running a home-grown boutique or a high-traffic retail outlet, LeadSync adapts structurally to your vertical.
                </p>
             </motion.div>
          )}

          {step === 3 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-[var(--app-text-muted)]" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
                  <Braces className="w-3.5 h-3.5" /> Inventory Schema
                </div>
                <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight text-[var(--app-text)]">
                  What fields do<br/>your products have?
                </h1>
                <p className="text-lg leading-relaxed max-w-md text-[var(--app-text-muted)]">
                  Define custom fields like brand, color, size, or material. These fields will appear when you add products to your inventory.
                </p>

                {/* Live Preview Card */}
                <div className="mt-8 rounded-2xl p-6 backdrop-blur-sm" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)', borderWidth: 1 }}>
                   <div className="flex flex-col gap-2 mb-4">
                     <span className="text-xs font-bold uppercase tracking-widest text-[var(--app-text-muted)]">Example Fields</span>
                     <span className="text-sm font-bold text-[var(--brand-saffron)]">
                       {businessType === "Fashion & Retail" && "Brand, Size, Color, Material"}
                       {businessType === "Bakery & Food" && "Flavor, Weight, Ingredients"}
                       {businessType === "Client Agency" && "Service Type, Duration, Package"}
                       {businessType === "Café & Food Outlet" && "Size, Temperature, Customization"}
                     </span>
                   </div>
                   <div className="space-y-3">
                     <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: 'var(--app-surface-alt)' }} />
                     <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: 'var(--app-surface-alt)' }} />
                     <div className="h-2 rounded-full w-5/6" style={{ backgroundColor: 'var(--app-surface-alt)' }} />
                   </div>
                   <div className="mt-6 pt-4 flex items-center gap-3" style={{ borderTopWidth: 1, borderTopColor: 'var(--app-border)' }}>
                     <Globe className="h-5 w-5" style={{ color: 'var(--brand-saffron)' }} />
                     <span className="text-sm font-medium text-[var(--app-text-muted)]">
                       You can add more fields later in Settings.
                     </span>
                   </div>
                </div>
             </motion.div>
          )}

          {step === 4 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-[var(--app-text-muted)]" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
                  <LineChart className="w-3.5 h-3.5" /> Migration Path
                </div>
                <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight text-[var(--app-text)]">
                  Start exactly<br/>where you left off.
                </h1>
                <p className="text-lg leading-relaxed max-w-md text-[var(--app-text-muted)]">
                  Whether you're switching from scribbled notebooks or massive excel sheets, we'll configure your dashboard to make the transition perfectly seamless.
                </p>

                {/* Live Preview Card */}
                <div className="mt-8 rounded-2xl p-6 backdrop-blur-sm" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)', borderWidth: 1 }}>
                   <div className="flex flex-col gap-2 mb-4">
                     <span className="text-xs font-bold uppercase tracking-widest text-[var(--app-text-muted)]">Recommended Action</span>
                     <span className="text-sm font-bold text-[var(--brand-saffron)]">
                       {currentWorkflow === "PAPER" && "Prepare for digital logging 📝"}
                       {currentWorkflow === "SPREADSHEET" && "Ready CSV for import 📊"}
                       {currentWorkflow === "CRM" && "Initialize CRM Sync 🔄"}
                     </span>
                   </div>
                   <div className="space-y-3">
                     <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: 'var(--app-surface-alt)' }} />
                     <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: 'var(--app-surface-alt)' }} />
                     <div className="h-2 rounded-full w-5/6" style={{ backgroundColor: 'var(--app-surface-alt)' }} />
                   </div>
                   <div className="mt-6 pt-4 flex items-center gap-3" style={{ borderTopWidth: 1, borderTopColor: 'var(--app-border)' }}>
                     <Globe className="h-5 w-5" style={{ color: 'var(--brand-saffron)' }} />
                     <span className="text-sm font-medium text-[var(--app-text-muted)]">
                       Setting up tailored empty states.
                     </span>
                   </div>
                </div>
             </motion.div>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-3 text-sm font-mono text-[var(--app-text-muted)]">
          <Shield className="h-4 w-4" />
          SOC2 Compliant Framework Placeholder
        </div>
      </div>

      {/* Right Column: Interactive Wizard Form */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto px-6 py-12 lg:px-16 xl:px-24" style={{ backgroundColor: 'var(--app-bg)' }}>
        <div className="w-full max-w-md mx-auto">
          
          {/* Header Progress for Mobile (Hidden on Desktop since left handles context, but good for progress) */}
          <div className="mb-12">
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4].map((s) => (
                <div 
                  key={s} 
                  className={`h-1.5 rounded-full transition-all duration-500 ease-out ${s <= step ? 'w-full' : 'w-full'}`}
                  style={{ backgroundColor: s <= step ? 'var(--brand-saffron)' : 'var(--app-border)' }}
                />
              ))}
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-[var(--app-text-muted)]">Step {step} of 4</p>
          </div>

          <AnimatePresence mode="wait">
            
            {/* STEP 1 */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight text-[var(--app-text)]">Your Profile</h2>
                  <p className="leading-relaxed text-sm text-[var(--app-text-muted)]">Tell us who will be managing this instance.</p>
                </div>

                <div className="space-y-3">
                  {/* Account Exists Banner */}
                  {accountExistsError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl border-2 flex items-start gap-3"
                      style={{ backgroundColor: 'rgba(166, 50, 50, 0.06)', borderColor: 'rgba(166, 50, 50, 0.2)' }}
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--danger-red)' }} />
                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ color: 'var(--danger-red)' }}>Account Already Exists</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>{accountExistsError}</p>
                        <button
                          onClick={onSwitchToSignIn}
                          className="mt-2 text-sm font-black underline hover:no-underline"
                          style={{ color: 'var(--danger-red)' }}
                        >
                          Sign in → 
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Sign Up with Google */}
                  <button 
                    type="button"
                    onClick={() => { window.location.href = "/api/auth/google/signup"; }}
                    className="w-full py-4 border-2 rounded-2xl flex items-center justify-center gap-3 transition-all font-bold text-sm cursor-pointer shadow-sm text-[var(--app-text)]"
                    style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-bg)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--app-border-strong)'; e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.backgroundColor = 'var(--app-bg)'; }}
                  >
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-5 w-5" alt="Google" />
                    Sign up with Google
                  </button>

                  <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t" style={{ borderColor: 'var(--app-border)' }} /></div>
                    <span className="relative px-4 text-[10px] font-black uppercase tracking-widest text-[var(--app-text-muted)]" style={{ backgroundColor: 'var(--app-bg)' }}>Or manually enter</span>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full border-2 rounded-2xl px-5 py-4 font-medium transition-all"
                          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          placeholder="John"
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full border-2 rounded-2xl px-5 py-4 font-medium transition-all"
                          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          placeholder="Doe"
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">Mobile Number</label>
                      <div className="flex rounded-2xl border-2 overflow-hidden transition-all" style={{ borderColor: 'var(--app-border)' }}>
                        <div className="px-5 flex items-center text-sm font-bold text-[var(--app-text-muted)]" style={{ backgroundColor: 'var(--app-bg-soft)', borderRightWidth: 2, borderRightColor: 'var(--app-border)' }}>
                          +91
                        </div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            if (v.length <= 10) setPhone(v);
                          }}
                          className="flex-1 px-5 py-4 font-medium tracking-wide transition-all"
                          style={{ backgroundColor: 'var(--app-input-bg)', color: 'var(--app-text)' }}
                          placeholder="98765 43210"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">Work Email</label>
                      <input
                        type="email"
                        value={mockEmail}
                        onChange={(e) => setMockEmail(e.target.value)}
                        className="w-full border-2 rounded-2xl px-5 py-4 font-medium transition-all"
                        style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        placeholder="john@company.com"
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">Email Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full border-2 rounded-2xl px-5 py-4 pr-12 font-medium transition-all"
                          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          placeholder="••••••••"
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors p-1 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <button
                    onClick={handleNextStep1}
                    className="w-full py-4.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    style={{ backgroundColor: 'var(--brand-saffron)', color: 'var(--app-bg)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-primary-strong)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-saffron)'; }}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                  
                  <div className="text-center">
                    <p className="text-xs font-medium text-[var(--app-text-muted)]">
                      Already using LeadSync?{" "}
                      <button 
                        onClick={onSwitchToSignIn}
                        className="font-black hover:underline cursor-pointer text-[var(--brand-saffron)]"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight text-[var(--app-text)]">Business Profile</h2>
                  <p className="leading-relaxed text-sm text-[var(--app-text-muted)]">How is your operation structured?</p>
                </div>

                <div className="space-y-6">
                  {/* Business Name */}
                  <div>
                    <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">Brand or Organization Name</label>
                    <input
                      type="text"
                      value={mockCompany}
                      onChange={(e) => setMockCompany(e.target.value)}
                      className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-lg transition-all"
                      style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                      placeholder="e.g. Acme Corp"
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                    />
                  </div>

                  {/* Operational Scale */}
                  <div>
                    <label className="text-xs font-bold mb-3 block text-[var(--app-text-muted)]">Business Scale</label>
                    <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl border" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
                      <button
                        onClick={() => setBusinessScale("HOME")}
                        className={`py-3.5 rounded-xl text-sm font-bold transition-all ${businessScale === "HOME" ? "shadow-sm text-[var(--brand-saffron)]" : "text-[var(--app-text-muted)] hover:bg-[var(--app-bg)]/50"}`}
                        style={businessScale === "HOME" ? { backgroundColor: 'var(--app-bg)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}
                      >
                        Home-Grown
                      </button>
                      <button
                        onClick={() => setBusinessScale("SME")}
                        className={`py-3.5 rounded-xl text-sm font-bold transition-all ${businessScale === "SME" ? "shadow-sm text-[var(--brand-saffron)]" : "text-[var(--app-text-muted)] hover:bg-[var(--app-bg)]/50"}`}
                        style={businessScale === "SME" ? { backgroundColor: 'var(--app-bg)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}
                      >
                        SME / Retail
                      </button>
                    </div>
                  </div>

                  {/* Vertical */}
                  <div>
                    <label className="text-xs font-bold mb-3 block text-[var(--app-text-muted)]">Primary Vertical</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "Fashion & Retail", icon: ShoppingBag, label: "Fashion & Retail" },
                        { id: "Bakery & Food", icon: Cake, label: "Bakery & Food" },
                        { id: "Client Agency", icon: Stethoscope, label: "Service / Clinic" },
                        { id: "Café & Food Outlet", icon: Utensils, label: "F&B Outlet" }
                      ].map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setBusinessType(v.id);
                            if (!mockCompany || mockCompany.includes("Boutique") || mockCompany.includes("Cakes")) {
                               if (v.id === "Bakery & Food") setMockCompany("Om Sai Cakes");
                               else if (v.id === "Fashion & Retail") setMockCompany("Om Sai Silk Boutique");
                               else if (v.id === "Client Agency") setMockCompany("Om Sai Advisory");
                               else setMockCompany("Om Sai Cafe");
                            }
                          }}
                          className={`flex items-center flex-col justify-center text-center gap-3 p-5 rounded-2xl border-2 transition-all`}
                          style={{
                            borderColor: businessType === v.id ? 'var(--brand-saffron)' : 'var(--app-border)',
                            backgroundColor: businessType === v.id ? 'var(--brand-saffron-soft)' : 'var(--app-bg)'
                          }}
                          onMouseEnter={(e) => { if (businessType !== v.id) e.currentTarget.style.borderColor = 'var(--app-border-strong)'; }}
                          onMouseLeave={(e) => { if (businessType !== v.id) e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                        >
                          <v.icon className={`w-6 h-6`} style={{ color: businessType === v.id ? 'var(--brand-saffron)' : 'var(--app-text-muted)' }} />
                          <span className={`text-xs font-bold`} style={{ color: businessType === v.id ? 'var(--brand-saffron)' : 'var(--app-text-muted)' }}>{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setStep(1)}
                    className="px-6 py-4.5 rounded-2xl font-bold transition-all text-sm border cursor-pointer"
                    style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-surface)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNextStep2}
                    className="flex-1 py-4.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    style={{ backgroundColor: 'var(--brand-saffron)', color: 'var(--app-bg)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-primary-strong)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-saffron)'; }}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 - Product Fields */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight text-[var(--app-text)]">Product Fields</h2>
                  <p className="leading-relaxed text-sm text-[var(--app-text-muted)]">Define the fields your products need (brand, size, color, etc.).</p>
                </div>

                <ProductFieldEditor onFieldsChange={setProductFields} />

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setStep(2)}
                    className="px-6 py-4.5 rounded-2xl font-bold transition-all text-sm border cursor-pointer"
                    style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-surface)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNextStep3}
                    className="flex-1 py-4.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    style={{ backgroundColor: 'var(--brand-saffron)', color: 'var(--app-bg)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-primary-strong)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-saffron)'; }}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4 - Workflow */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight text-[var(--app-text)]">Your Current Workflow</h2>
                  <p className="leading-relaxed text-sm text-[var(--app-text-muted)]">How are you currently tracking your leads and orders?</p>
                </div>

                <div className="space-y-4">
                  {(["PAPER", "SPREADSHEET", "CRM"] as const).map((wf) => {
                    const isActive = currentWorkflow === wf;
                    const icons = { PAPER: Target, SPREADSHEET: LineChart, CRM: Component } as const;
                    const Icon = icons[wf];
                    const labels = {
                      PAPER: { title: "Pen, Paper & Notebooks", desc: "I'm manually writing things down or keeping it in my head." },
                      SPREADSHEET: { title: "Excel / Google Sheets", desc: "I have digital records that I maintain manually in columns." },
                      CRM: { title: "Another CRM or App", desc: "I need to migrate from an existing software tool." },
                    };
                    return (
                      <button
                        key={wf}
                        onClick={() => setCurrentWorkflow(wf)}
                        className="w-full flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left cursor-pointer"
                        style={{
                          borderColor: isActive ? 'var(--brand-saffron)' : 'var(--app-border)',
                          backgroundColor: isActive ? 'var(--brand-saffron-soft)' : 'var(--app-bg)',
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'var(--app-border-strong)'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                      >
                        <div className="p-2.5 rounded-xl" style={{ backgroundColor: isActive ? 'var(--brand-saffron)' : 'var(--app-surface)', color: isActive ? 'var(--app-bg)' : 'var(--app-text-muted)' }}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm" style={{ color: isActive ? 'var(--brand-saffron)' : 'var(--app-text)' }}>{labels[wf].title}</div>
                          <div className="text-xs mt-1 leading-relaxed text-[var(--app-text-muted)]">{labels[wf].desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setStep(3)}
                    className="px-6 py-4.5 rounded-2xl font-bold transition-all text-sm border cursor-pointer"
                    style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-surface)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalize}
                    className="flex-1 py-4.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    style={{ backgroundColor: 'var(--brand-saffron)', color: 'var(--app-bg)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-primary-strong)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-saffron)'; }}
                  >
                    Deploy Dashboard <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

