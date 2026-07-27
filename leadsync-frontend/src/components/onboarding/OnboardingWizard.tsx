import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Shield, Check, Sparkles,
  Utensils, ShoppingBag, Stethoscope, 
  User, 
  Component,
  Eye, EyeOff, AlertTriangle,
  Scissors, Store
} from "lucide-react";
import { toast } from "react-hot-toast";

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
  const [businessType, setBusinessType] = useState("Retail / Shop");

  const handleNextStep1 = () => {
    if (!firstName.trim()) {
      toast.error("Please enter your first name.");
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

  const handleFinalize = () => {
    onComplete({
      businessScale,
      businessType,
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
          <img src="/salira-logo.png" alt="SaLira" className="h-10 w-10 rounded-xl object-contain shadow-xl shadow-orange-500/20" />
          <div>
            <span className="font-black tracking-tight text-xl text-[var(--app-text)]">SaLira</span>
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
                  Whether you're running a home-grown boutique or a high-traffic retail outlet, SaLira adapts structurally to your vertical.
                </p>
             </motion.div>
          )}

          {step === 3 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-[var(--app-text-muted)]" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
                  <Sparkles className="w-3.5 h-3.5" /> All Set
                </div>
                <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight text-[var(--app-text)]">
                  Welcome aboard,<br/>{mockCompany || "your business"} 👋
                </h1>
                <p className="text-lg leading-relaxed max-w-md text-[var(--app-text-muted)]">
                  Big things start here — welcome to SaLira.
                </p>
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
              {[1, 2, 3].map((s) => (
                <div 
                  key={s} 
                  className={`h-1.5 rounded-full transition-all duration-500 ease-out ${s <= step ? 'w-full' : 'w-full'}`}
                  style={{ backgroundColor: s <= step ? 'var(--brand-saffron)' : 'var(--app-border)' }}
                />
              ))}
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-[var(--app-text-muted)]">Step {step} of 3</p>
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
                        <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">
                          First Name <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full border-2 rounded-2xl px-5 py-4 font-medium transition-all"
                          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          placeholder=""
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
                          placeholder=""
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">
                        Mobile Number <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="flex gap-3">
                        <div 
                          className="w-20 border-2 rounded-2xl px-4 py-4 font-bold text-sm flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        >
                          +91
                        </div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            if (v.length <= 10) setPhone(v);
                          }}
                          className="flex-1 border-2 rounded-2xl px-5 py-4 font-medium tracking-wide transition-all"
                          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          placeholder=""
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">
                        Work Email <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="email"
                        value={mockEmail}
                        onChange={(e) => setMockEmail(e.target.value)}
                        className="w-full border-2 rounded-2xl px-5 py-4 font-medium transition-all"
                        style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        placeholder=""
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-saffron)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">
                        Email Password <span className="text-red-500 ml-0.5">*</span>
                      </label>
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
                      Already using SaLira?{" "}
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
                    <label className="text-xs font-bold mb-2 block text-[var(--app-text-muted)]">
                      Brand or Organization Name <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      value={mockCompany}
                      onChange={(e) => setMockCompany(e.target.value)}
                      className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-lg transition-all"
                      style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                      placeholder="Your brand/company name"
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

                  {/* Scale Helper Feedback */}
                  <motion.div
                    key={businessScale}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-2xl border p-4 space-y-3"
                    style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}
                  >
                    <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      {businessScale === "HOME"
                        ? "No GST needed. Simple setup for personal/home sellers."
                        : "GST invoicing enabled. Built for registered businesses."}
                    </p>
                    <div className="flex flex-col gap-2">
                      {(businessScale === "HOME"
                        ? ["Quick setup", "No tax fields", "Upgrade anytime"]
                        : ["GST invoice field", "Business-grade profile", "Tax-ready orders"]
                      ).map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--brand-saffron-soft)' }}>
                            <Check className="h-2.5 w-2.5" style={{ color: 'var(--brand-saffron)' }} />
                          </div>
                          <span className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Vertical */}
                  <div>
                    <label className="text-xs font-bold mb-3 block text-[var(--app-text-muted)]">Primary Vertical</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "Retail / Shop", icon: ShoppingBag, label: "Retail / Shop" },
                        { id: "Handmade / Crafts", icon: Scissors, label: "Handmade / Crafts" },
                        { id: "Food & Beverage", icon: Utensils, label: "Food & Beverage" },
                        { id: "Services / Appointments", icon: Stethoscope, label: "Services / Appointments" },
                        { id: "Other / General", icon: Store, label: "Other / General" }
                      ].map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setBusinessType(v.id);
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

            {/* STEP 3 - Welcome */}
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
                  <h2 className="text-3xl font-black tracking-tight text-[var(--app-text)]">
                    Welcome aboard, {mockCompany || "your business"} 👋
                  </h2>
                  <p className="leading-relaxed text-sm text-[var(--app-text-muted)]">
                    Big things start here — welcome to SaLira.
                  </p>
                </div>

                <div className="rounded-2xl border p-6 space-y-3" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>
                    Everything's set up and ready when you are.
                  </p>
                  <p className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                    Connect a channel anytime from Settings to go live.
                  </p>
                </div>

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
                    onClick={handleFinalize}
                    className="flex-1 py-4.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    style={{ backgroundColor: 'var(--brand-saffron)', color: 'var(--app-bg)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-primary-strong)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-saffron)'; }}
                  >
                    Go to my Dashboard <ArrowRight className="h-4 w-4" />
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

