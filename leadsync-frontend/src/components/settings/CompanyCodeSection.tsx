import toast from "react-hot-toast";

interface CompanyCodeSectionProps {
  companyCode: string;
}

export function CompanyCodeSection({
  companyCode,
}: CompanyCodeSectionProps) {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(companyCode);
    toast.success("Company Code copied to clipboard!");
  };

  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border border-rose-100 space-y-4 relative overflow-hidden" id="settings-company-code-section">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-full -z-0 pointer-events-none" />
      
      <div className="relative z-10 flex items-start gap-4">
        <div className="bg-rose-100 p-2.5 rounded-xl text-rose-600 mt-0.5">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Company Access Code</h2>
          <p className="text-sm text-slate-500">
            This highly confidential code acts as a unique identifier for your business. Provide this code to your admins and staff so they can securely log into your company portal.
          </p>
        </div>
      </div>

      <div className="pt-2 relative z-10">
        <div className="max-w-md space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            Company Code (Login ID)
            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] uppercase">Auto-Allocated & Confidential</span>
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={companyCode}
              readOnly
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold tracking-wider text-slate-600 focus:outline-none cursor-not-allowed"
            />
            <button
              onClick={handleCopyCode}
              className="bg-rose-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-rose-700 transition shadow-sm self-end flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Note: This code is automatically generated and permanently assigned to your company for security purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
