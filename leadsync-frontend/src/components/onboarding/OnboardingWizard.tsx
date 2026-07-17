import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Shield, 
  Utensils, ShoppingBag, Stethoscope, 
  Cake, Sparkles, User, 
  Target, Component, LineChart, Globe, ZapIcon,
  Eye, EyeOff, AlertTriangle
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
  const [businessType, setBusinessType] = useState("Fashion & Retail");
  const [currentWorkflow, setCurrentWorkflow] = useState<"PAPER" | "SPREADSHEET" | "CRM">("PAPER");

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

  const handleFinalize = () => {
    onComplete({
      businessScale,
      businessType,
      currentWorkflow,
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
      className="flex-1 flex min-h-screen bg-white w-full"
    >
      {/* Left Column: Dynamic Branding / Value Prop (Hidden on smaller screens) */}
      <div className="hidden lg:flex w-[45%] bg-slate-950 text-white flex-col justify-between p-12 lg:p-16 relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute top-1/2 -left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl opacity-50 text-white" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-teal-500/20">
            <ZapIcon className="h-5 w-5 fill-current text-white" />
          </div>
          <div>
            <span className="font-black text-white tracking-tight text-xl">LeadSync</span>
            <span className="text-[10px] text-teal-400 font-bold ml-2 uppercase tracking-widest bg-teal-400/10 px-2 py-0.5 rounded-full border border-teal-400/20">Sandbox</span>
          </div>
        </div>

        <div className="relative z-10 space-y-12">
          {step === 1 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-xs font-medium text-slate-300">
                  <User className="w-3.5 h-3.5" /> Workspace Identity
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                  Welcome.<br/>Let's configure your command center.
                </h1>
                <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                  Establish your secure administration seat to begin orchestrating leads, dispatch queues, and customer relations.
                </p>
             </motion.div>
          )}

          {step === 2 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-xs font-medium text-slate-300">
                  <Component className="w-3.5 h-3.5" /> Merchant DNA
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                  What are we<br/>building today?
                </h1>
                <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                  Whether you're running a home-grown boutique or a high-traffic retail outlet, LeadSync adapts structurally to your vertical.
                </p>
             </motion.div>
          )}

          {step === 3 && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-xs font-medium text-slate-300">
                  <LineChart className="w-3.5 h-3.5" /> Migration Path
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                  Start exactly<br/>where you left off.
                </h1>
                <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                  Whether you're switching from scribbled notebooks or massive excel sheets, we'll configure your dashboard to make the transition perfectly seamless.
                </p>

                {/* Live Preview Card */}
                <div className="mt-8 bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                   <div className="flex flex-col gap-2 mb-4">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recommended Action</span>
                     <span className="text-sm text-teal-400 font-bold">
                       {currentWorkflow === "PAPER" && "Prepare for digital logging 📝"}
                       {currentWorkflow === "SPREADSHEET" && "Ready CSV for import 📊"}
                       {currentWorkflow === "CRM" && "Initialize CRM Sync 🔄"}
                     </span>
                   </div>
                   <div className="space-y-3">
                     <div className="h-2 bg-slate-800 rounded-full w-3/4" />
                     <div className="h-2 bg-slate-800 rounded-full w-1/2" />
                     <div className="h-2 bg-slate-800 rounded-full w-5/6" />
                   </div>
                   <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-3">
                     <Globe className="h-5 w-5 text-blue-400" />
                     <span className="text-sm font-medium text-slate-300">
                       Setting up tailored empty states.
                     </span>
                   </div>
                </div>
             </motion.div>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-3 text-sm text-slate-500 font-mono">
          <Shield className="h-4 w-4" />
          SOC2 Compliant Framework Placeholder
        </div>
      </div>

      {/* Right Column: Interactive Wizard Form */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto px-6 py-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          
          {/* Header Progress for Mobile (Hidden on Desktop since left handles context, but good for progress) */}
          <div className="mb-12">
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s} 
                  className={`h-1.5 rounded-full transition-all duration-500 ease-out ${s <= step ? 'w-full bg-teal-600' : 'w-full bg-slate-100'}`} 
                />
              ))}
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Step {step} of 3</p>
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
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Profile</h2>
                  <p className="text-slate-500 leading-relaxed text-sm">Tell us who will be managing this instance.</p>
                </div>

                <div className="space-y-3">
                  {/* Account Exists Banner */}
                  {accountExistsError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl border-2 flex items-start gap-3"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ color: '#dc2626' }}>Account Already Exists</p>
                        <p className="text-xs mt-1" style={{ color: '#991b1b' }}>{accountExistsError}</p>
                        <button
                          onClick={onSwitchToSignIn}
                          className="mt-2 text-sm font-black underline hover:no-underline"
                          style={{ color: '#dc2626' }}
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
                    className="w-full py-4 border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 rounded-2xl flex items-center justify-center gap-3 transition-all font-bold text-sm text-slate-700 cursor-pointer shadow-sm"
                  >
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-5 w-5" alt="Google" />
                    Sign up with Google
                  </button>

                  <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                    <span className="relative px-4 text-[10px] font-black text-slate-400 bg-white uppercase tracking-widest">Or manually enter</span>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-2 block">First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:border-teal-500 transition-all font-medium"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-2 block">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:border-teal-500 transition-all font-medium"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-2 block">Mobile Number</label>
                      <div className="flex rounded-2xl border-2 border-slate-100 overflow-hidden focus-within:border-teal-500 transition-all">
                        <div className="bg-slate-50 px-5 flex items-center border-r-2 border-slate-100 text-sm font-bold text-slate-500">
                          +91
                        </div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            if (v.length <= 10) setPhone(v);
                          }}
                          className="flex-1 bg-white px-5 py-4 text-slate-900 focus:outline-none font-medium tracking-wide"
                          placeholder="98765 43210"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-2 block">Work Email</label>
                      <input
                        type="email"
                        value={mockEmail}
                        onChange={(e) => setMockEmail(e.target.value)}
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:border-teal-500 transition-all font-medium"
                        placeholder="john@company.com"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-2 block">Email Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 pr-12 text-slate-900 focus:outline-none focus:border-teal-500 transition-all font-medium"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
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
                    className="w-full py-4.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-slate-900/20 text-sm"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                  
                  <div className="text-center">
                    <p className="text-xs text-slate-500 font-medium">
                      Already using LeadSync?{" "}
                      <button 
                        onClick={onSwitchToSignIn}
                        className="text-teal-600 font-black hover:underline cursor-pointer"
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
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Business Profile</h2>
                  <p className="text-slate-500 leading-relaxed text-sm">How is your operation structured?</p>
                </div>

                <div className="space-y-6">
                  {/* Business Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-2 block">Brand or Organization Name</label>
                    <input
                      type="text"
                      value={mockCompany}
                      onChange={(e) => setMockCompany(e.target.value)}
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:border-teal-500 transition-all font-bold text-lg"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>

                  {/* Operational Scale */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-3 block">Business Scale</label>
                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <button
                        onClick={() => setBusinessScale("HOME")}
                        className={`py-3.5 rounded-xl text-sm font-bold transition-all ${businessScale === "HOME" ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/50"}`}
                      >
                        Home-Grown
                      </button>
                      <button
                        onClick={() => setBusinessScale("SME")}
                        className={`py-3.5 rounded-xl text-sm font-bold transition-all ${businessScale === "SME" ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/50"}`}
                      >
                        SME / Retail
                      </button>
                    </div>
                  </div>

                  {/* Vertical */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-3 block">Primary Vertical</label>
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
                          className={`flex items-center flex-col justify-center text-center gap-3 p-5 rounded-2xl border-2 transition-all ${businessType === v.id ? "border-teal-500 bg-teal-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                        >
                          <v.icon className={`w-6 h-6 ${businessType === v.id ? "text-teal-600" : "text-slate-400"}`} />
                          <span className={`text-xs font-bold ${businessType === v.id ? "text-teal-800" : "text-slate-600"}`}>{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setStep(1)}
                    className="px-6 py-4.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold transition-all text-sm border border-slate-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNextStep2}
                    className="flex-1 py-4.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-slate-900/20 text-sm"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 */}
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
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Current Workflow</h2>
                  <p className="text-slate-500 leading-relaxed text-sm">How are you currently tracking your leads and orders?</p>
                </div>

                <div className="space-y-4">
                  <button
                     onClick={() => setCurrentWorkflow("PAPER")}
                     className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${currentWorkflow === "PAPER" ? "border-teal-500 bg-teal-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                  >
                     <div className={`p-2.5 rounded-xl ${currentWorkflow === "PAPER" ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                       <Target className="w-5 h-5" />
                     </div>
                     <div>
                       <div className={`font-bold text-sm ${currentWorkflow === "PAPER" ? "text-teal-900" : "text-slate-800"}`}>Pen, Paper & Notebooks</div>
                       <div className="text-xs text-slate-500 mt-1 leading-relaxed">I'm manually writing things down or keeping it in my head.</div>
                     </div>
                  </button>

                  <button
                     onClick={() => setCurrentWorkflow("SPREADSHEET")}
                     className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${currentWorkflow === "SPREADSHEET" ? "border-teal-500 bg-teal-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                  >
                     <div className={`p-2.5 rounded-xl ${currentWorkflow === "SPREADSHEET" ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                       <LineChart className="w-5 h-5" />
                     </div>
                     <div>
                       <div className={`font-bold text-sm ${currentWorkflow === "SPREADSHEET" ? "text-teal-900" : "text-slate-800"}`}>Excel / Google Sheets</div>
                       <div className="text-xs text-slate-500 mt-1 leading-relaxed">I have digital records that I maintain manually in columns.</div>
                     </div>
                  </button>

                  <button
                     onClick={() => setCurrentWorkflow("CRM")}
                     className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${currentWorkflow === "CRM" ? "border-teal-500 bg-teal-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                  >
                     <div className={`p-2.5 rounded-xl ${currentWorkflow === "CRM" ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                       <Component className="w-5 h-5" />
                     </div>
                     <div>
                       <div className={`font-bold text-sm ${currentWorkflow === "CRM" ? "text-teal-900" : "text-slate-800"}`}>Another CRM or App</div>
                       <div className="text-xs text-slate-500 mt-1 leading-relaxed">I need to migrate from an existing software tool.</div>
                     </div>
                  </button>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setStep(2)}
                    className="px-6 py-4.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold transition-all text-sm border border-slate-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalize}
                    className="flex-1 py-4.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-teal-500/25 text-sm"
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

