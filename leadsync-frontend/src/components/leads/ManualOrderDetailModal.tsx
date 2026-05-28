import { motion, AnimatePresence } from "framer-motion";
import { X, Clipboard, MapPin } from "lucide-react";
import toast from "react-hot-toast";

interface ManualOrderDetailModalProps {
  order: any | null;
  onClose: () => void;
}

export default function ManualOrderDetailModal({
  order,
  onClose,
}: ManualOrderDetailModalProps) {
  if (!order) return null;

  const baseSummary = order.items?.baseSummary || order.summary;
  const agentName = order.items?.agentName || order.processedBy?.name || "Agent";
  const city = order.items?.city || "—";
  const state = order.items?.state || "—";
  const streetLocation = order.items?.location || order.location || "—";
  const customerName = order.lead?.name || "Customer";
  const contact = order.lead?.contact || "—";
  const priority = order.priority || "NORMAL";
  const amount = order.amount || 0;
  
  const createdAtDate = order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) : "—";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-app-surface rounded-[24px] shadow-2xl w-full max-w-xl overflow-hidden relative z-10 border border-app flex flex-col font-sans select-none"
        >
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#0047cc] p-6 text-white text-left relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 text-white/80 hover:text-white hover:bg-app-surface/10 rounded-lg transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-1.5 font-sans">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-app-surface/20 text-white">
                📝 Manual Entry Details
              </span>
              <span className={`inline-block text-center text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md ${
                priority === "URGENT" ? "bg-red-500 text-white" : "bg-slate-700 text-slate-200"
              }`}>
                {priority} Priority
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-white">
              {customerName}
            </h3>
            <p className="text-slate-300 text-xs font-mono font-bold mt-1">
              📞 {contact}
            </p>
          </div>

          {/* Content body */}
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto text-left bg-app-bg/50 font-sans">
            
            {/* Section 1: Core Order Overview */}
            <div className="bg-app-surface rounded-2xl p-4 border border-app shadow-sm space-y-3.5">
              <div className="border-b border-app pb-2 mb-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📦 Product & Order Information</h4>
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Order Summary & Items Description</span>
                <p className="text-app-text text-xs font-semibold leading-relaxed whitespace-pre-line mt-1 bg-app-bg p-3 rounded-xl border border-app">
                  {baseSummary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Total Value / Amount</span>
                  <p className="text-app-text text-base font-black mt-1 flex items-center gap-1">
                    <span className="text-app-muted text-xs font-bold">₹</span>
                    {amount.toLocaleString("en-IN")}
                  </p>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Recorded Date & Time</span>
                  <p className="text-app-text text-xs font-semibold mt-1">
                    {createdAtDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Address & Geography */}
            <div className="bg-app-surface rounded-2xl p-4 border border-app shadow-sm space-y-3.5">
              <div className="border-b border-app pb-2 mb-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📍 Delivery Address</h4>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl mt-0.5">
                  <MapPin size={16} />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 font-sans">Street / Delivery Address</span>
                    <p className="text-app-text text-xs font-semibold mt-0.5">
                      {streetLocation}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 font-sans">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">City / Local Area</span>
                      <span className="inline-block mt-1 text-app-text text-xs font-bold bg-app-bg-soft px-2.5 py-1 rounded-lg border border-app">
                        Read Only: 🏙️ {city}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">State / Province</span>
                      <span className="inline-block mt-1 text-app-text text-xs font-bold bg-app-bg-soft px-2.5 py-1 rounded-lg border border-app">
                        Read Only: 🗺️ {state}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Responsible Agent */}
            <div className="bg-app-surface rounded-2xl p-4 border border-app shadow-sm space-y-3">
              <div className="border-b border-app pb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">👤 Responsible Agent</h4>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center text-sm">
                  {agentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-app-text">{agentName}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans">Agent on duty</p>
                </div>
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="border-t border-app p-5 bg-app-surface flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                const text = `Customer Name: ${customerName}\nContact: ${contact}\nDelivery Address: ${streetLocation}, ${city}, ${state}\nOrder Items: ${baseSummary}\nValue: ₹${amount}\nRecorded by agent: ${agentName}\nDate: ${createdAtDate}`;
                navigator.clipboard.writeText(text);
                toast.success("Complete order details copied!");
              }}
              className="px-4 py-2.5 bg-app-bg-soft hover:bg-app-bg-soft text-app-text rounded-xl text-xs font-bold border border-app active:scale-95 transition flex items-center gap-1.5 cursor-pointer font-sans"
            >
              <Clipboard size={14} />
              Copy Technical Summary
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold active:scale-95 transition cursor-pointer font-sans"
            >
              Done
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
