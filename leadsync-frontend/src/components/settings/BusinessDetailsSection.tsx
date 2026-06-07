interface BusinessDetailsSectionProps {
  businessName: string;
  setBusinessName: (value: string) => void;
  businessAddress: string;
  setBusinessAddress: (value: string) => void;
  gstin: string;
  setGstin: (value: string) => void;
  handleSaveBusinessDetails: () => void;
}

export function BusinessDetailsSection({
  businessName,
  setBusinessName,
  businessAddress,
  setBusinessAddress,
  gstin,
  setGstin,
  handleSaveBusinessDetails,
}: BusinessDetailsSectionProps) {
  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4" id="settings-business-details-section">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span>🏢</span> Business Details (For Invoices)
      </h2>
      <p className="text-sm text-slate-500">
        These details will appear on the invoices generated for your customers.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Legal Business Name</label>
          <input
            type="text"
            placeholder="Ex: Green Earth Cafe"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">GSTIN (Optional)</label>
          <input
            type="text"
            placeholder="Ex: 29AAAAA0000A1Z5"
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registered Address</label>
          <textarea
            placeholder="Full address for invoice header..."
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none h-20"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          id="btn-save-business-details"
          onClick={handleSaveBusinessDetails}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm font-bold"
        >
          Save Business Details
        </button>
      </div>
    </div>
  );
}
