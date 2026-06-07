import React from "react";

interface MenuItem {
  name: string;
  price: number;
  stock?: number;
}

interface Category {
  name: string;
  items: MenuItem[];
}

interface StructuredMenu {
  categories: Category[];
}

interface CommerceOnboardingSectionProps {
  onboardingMode: 'PASTE' | 'MANUAL' | 'FILE';
  setOnboardingMode: (mode: 'PASTE' | 'MANUAL' | 'FILE') => void;
  shopDescription: string;
  setShopDescription: (value: string) => void;
  isGenerating: boolean;
  handleAnalyzeSmartPaste: () => void;
  mergeWithExisting: boolean;
  setMergeWithExisting: (value: boolean) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  downloadCsvTemplate: () => void;
  botBusinessType: string;
  setBotBusinessType: (value: string) => void;
  botWelcomeMessage: string;
  setBotWelcomeMessage: (value: string) => void;
  saveEditedMenu: () => void;
  previewMenu: StructuredMenu | null;
  setPreviewMenu: (menu: StructuredMenu | null) => void;
  handleConfirmPreview: () => void;
}

export function CommerceOnboardingSection({
  onboardingMode,
  setOnboardingMode,
  shopDescription,
  setShopDescription,
  isGenerating,
  handleAnalyzeSmartPaste,
  mergeWithExisting,
  setMergeWithExisting,
  handleFileUpload,
  downloadCsvTemplate,
  botBusinessType,
  setBotBusinessType,
  botWelcomeMessage,
  setBotWelcomeMessage,
  saveEditedMenu,
  previewMenu,
  setPreviewMenu,
  handleConfirmPreview,
}: CommerceOnboardingSectionProps) {
  return (
    <>
      {/* COMMERCE AI ONBOARDING WIZARD */}
      <div className="bg-app-surface p-8 rounded-3xl shadow-xl border border-app space-y-6 relative overflow-hidden" id="commerce-onboarding-section">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>

        <div className="relative">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span>📦</span> Commerce Onboarding
          </h2>
          <p className="text-slate-500 text-sm mt-1">Populate your shop menu using AI paste or manual entry.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setOnboardingMode('PASTE')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'PASTE' ? 'bg-app-surface text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ✨ AI Smart Paste
          </button>
          <button
            onClick={() => setOnboardingMode('MANUAL')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'MANUAL' ? 'bg-app-surface text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🧱 Manual Entry
          </button>
          <button
            onClick={() => setOnboardingMode('FILE')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${onboardingMode === 'FILE' ? 'bg-app-surface text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🧾 Upload Document
          </button>
        </div>

        {onboardingMode === 'PASTE' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Instructions</p>
              <p className="text-sm text-indigo-900/70">Paste your raw product list, price menu, or even a WhatsApp message. Our AI will extract items and prices for you.</p>
            </div>

            <textarea
              placeholder="Ex: 
Cold Brew Coffee - 250
Latte - 300
Cheese Croissant 180..."
              value={shopDescription}
              onChange={(e) => setShopDescription(e.target.value)}
              className="w-full border-2 border-app rounded-2xl px-4 py-4 h-48 focus:border-indigo-500 focus:ring-0 transition-all text-sm font-medium bg-app-bg/30"
            />

            <div className="flex items-center gap-3">
              <button
                id="btn-analyze-smart-paste"
                onClick={handleAnalyzeSmartPaste}
                disabled={isGenerating || !shopDescription.trim()}
                className={`bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95 ${isGenerating ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-700 hover:shadow-indigo-200"}`}
              >
                {isGenerating ? "Analyzing..." : "Analyze & Preview"}
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mergeCheck"
                  checked={mergeWithExisting}
                  onChange={(e) => setMergeWithExisting(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mergeCheck" className="text-xs font-bold text-slate-500 cursor-pointer">Merge with existing items</label>
              </div>
            </div>
          </div>
        ) : onboardingMode === 'FILE' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Document Analysis</p>
                <p className="text-sm text-indigo-900/70">Upload PDF, Word, Excel, or CSV catalogs.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={downloadCsvTemplate}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Download CSV Template ↓
                </button>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-app rounded-3xl cursor-pointer hover:bg-app-bg hover:border-indigo-400 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <div className="bg-indigo-50 p-4 rounded-full text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                </div>
                <p className="text-sm font-bold text-app-muted">Click to upload catalog</p>
                <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, XLSX, CSV (Max 10MB)</p>
              </div>
              <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Business Category</label>
                <input
                  type="text"
                  placeholder="e.g. Organic Cafe"
                  value={botBusinessType}
                  onChange={(e) => setBotBusinessType(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bot Welcome Message</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome to our store!"
                  value={botWelcomeMessage}
                  onChange={(e) => setBotWelcomeMessage(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 italic">Use the "Master Catalog" tab to manage your products individually.</p>
            <button
              id="btn-save-basic-settings"
              onClick={saveEditedMenu}
              className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-900 transition-all text-sm"
            >
              Save Basic Settings
            </button>
          </div>
        )}
      </div>

      {/* PREVIEW MODAL / SECTION */}
      {previewMenu && (
        <div className="bg-amber-50 p-8 rounded-3xl border-2 border-amber-200 shadow-xl space-y-6 animate-in zoom-in-95 duration-300" id="commerce-preview-modal">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-amber-900 tracking-tight flex items-center gap-2">
                <span>👁️</span> Extraction Preview
              </h3>
              <p className="text-amber-800/60 text-sm font-medium">Verify the data before committing to your shop.</p>
            </div>
            <button
              onClick={() => setPreviewMenu(null)}
              className="text-amber-900/40 hover:text-amber-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {previewMenu.categories.map((cat, ci) => (
              <div key={ci} className="bg-app-surface p-4 rounded-2xl border border-amber-100 shadow-sm">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 px-1">{cat.name}</p>
                <div className="space-y-1.5">
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="flex justify-between items-center text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-700 font-medium">{item.name}</span>
                      <div className="flex items-center gap-3">
                        {item.stock !== undefined && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                            Stock: {item.stock}
                          </span>
                        )}
                        <span className="text-indigo-600 font-bold">₹{item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              id="btn-confirm-preview-save"
              onClick={handleConfirmPreview}
              className="flex-1 bg-green-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-100 hover:bg-green-700 hover:shadow-green-200 transition-all active:scale-95"
            >
              Confirm & Save to Menu ✅
            </button>
            <button
              onClick={() => setPreviewMenu(null)}
              className="bg-app-surface text-slate-500 px-6 py-4 rounded-2xl font-bold border border-app hover:bg-app-bg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
