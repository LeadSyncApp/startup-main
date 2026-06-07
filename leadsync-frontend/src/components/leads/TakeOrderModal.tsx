import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, X as CloseIcon } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";

interface TakeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  menuCategories: any[];
  onSuccess: () => void;
  initialCustomerName?: string;
  initialPhoneNumber?: string;
}

export default function TakeOrderModal({
  isOpen,
  onClose,
  user,
  menuCategories,
  onSuccess,
  initialCustomerName = "",
  initialPhoneNumber = "",
}: TakeOrderModalProps) {
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newOrderSummary, setNewOrderSummary] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newPriority, setNewPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMenuItems, setSelectedMenuItems] = useState<Array<{ name: string; price: number; quantity: number; productId?: string }>>([]);

  const agentName = user?.name || "Agent";

  // Pre-fill / reset states whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setNewCustomerName(initialCustomerName);
      setNewPhoneNumber(initialPhoneNumber);
      setNewLocation("");
      setNewCity("");
      setNewState("");
      setNewOrderSummary("");
      setNewAmount("");
      setNewPriority("NORMAL");
      setSelectedMenuItems([]);
    }
  }, [isOpen, initialCustomerName, initialPhoneNumber]);

  // Synchronize selected menu items to Order Items Text Area and Amount input
  useEffect(() => {
    if (selectedMenuItems.length > 0) {
      const summary = selectedMenuItems
        .map(item => `${item.quantity}x ${item.name}`)
        .join(", ");
      setNewOrderSummary(summary);
      
      const totalAmount = selectedMenuItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      setNewAmount(totalAmount.toString());
    } else {
      setNewOrderSummary("");
      setNewAmount("");
    }
  }, [selectedMenuItems]);

  // Helper actions for items
  const handleSelectMenuItem = (name: string, price: number, productId?: string) => {
    setSelectedMenuItems((prev) => {
      const existingIdx = prev.findIndex(item => item.name === name);
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }
      return [...prev, { name, price, quantity: 1, productId }];
    });
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    setSelectedMenuItems((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index].quantity = newQty;
      }
      return next;
    });
  };

  const handleRemoveMenuItem = (index: number) => {
    setSelectedMenuItems((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newPhoneNumber.trim() || !newOrderSummary.trim()) {
      toast.error("Please fill in Customer Name, Phone Number, and Order Details");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/orders", {
        customerName: newCustomerName.trim(),
        phoneNumber: newPhoneNumber.trim(),
        location: newLocation.trim(),
        summary: newOrderSummary.trim(),
        amount: newAmount ? parseFloat(newAmount) : 0,
        priority: newPriority,
        isUrgent: newPriority === "URGENT",
        agentName,
        city: newCity.trim(),
        state: newState.trim(),
        items: selectedMenuItems.map(item => ({
          productId: item.productId || null,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }))
      });

      toast.success("Order manually taken and recorded successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to finalize order creation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden relative z-10 border border-slate-200 flex flex-col font-sans select-none"
          >
            {/* Header block with gradient background */}
            <div className="bg-gradient-to-r from-[#0047cc] to-blue-600 p-6 text-white text-left relative">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 p-1 text-white/80 hover:text-white hover:bg-app-surface/10 rounded-lg transition"
              >
                <X size={18} />
              </button>
              <h3 className="text-lg font-bold">🛒 Take Custom Order / Create Lead</h3>
              <p className="text-xs text-blue-100 mt-1 font-medium font-sans">Create a new manual lead and take their custom order in a single click. It automatically searches or populates details in LeadSync CRM.</p>
            </div>

            {/* Form container */}
            <form onSubmit={handleCreateOrderSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-left">
              
              {/* General Customer Details Subheader */}
              <div className="border-b border-app pb-2 mb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Customer Details</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="customer-name">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="phone-number">
                    Phone Number / Contact <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="phone-number"
                    type="text"
                    required
                    placeholder="e.g. +91 9876543210"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="agent-name">
                    Recorded By (Agent Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="agent-name"
                    type="text"
                    required
                    disabled
                    placeholder="Prefilled logged-in user"
                    value={agentName}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-app rounded-xl text-slate-500 text-xs font-semibold focus:outline-none cursor-not-allowed select-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="delivery-location">
                    Street / Delivery Address
                  </label>
                  <input
                    id="delivery-location"
                    type="text"
                    placeholder="e.g. Flat 104, Block B"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="location-city">
                    City / Location Local Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="location-city"
                    type="text"
                    required
                    placeholder="e.g. New Delhi"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="location-state">
                    State / Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="location-state"
                    type="text"
                    required
                    placeholder="e.g. Delhi"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* General Order Details Subheader */}
              <div className="border-b border-app pb-2 pt-2 mb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Order Items & Status</h4>
              </div>

              {/* Menu Item Selector if categories exist */}
              {menuCategories && menuCategories.length > 0 ? (
                <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <div className="flex items-center justify-between border-b border-app/80 pb-2 mb-1">
                    <span className="text-xs font-bold text-slate-700">Add Items from Menu Catalog</span>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-full border border-blue-100 font-sans">
                      {menuCategories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)} items loaded
                    </span>
                  </div>
                  
                  {/* Catalog Dropdown Selector */}
                  <div className="flex gap-2 items-center">
                    <select
                      id="menu-item-dropdown"
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer text-left font-sans"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const [catIdx, itemIdx] = val.split("-").map(Number);
                          const item = menuCategories[catIdx]?.items?.[itemIdx];
                          if (item) {
                            handleSelectMenuItem(item.name, Number(item.price) || 0, item.item_id || item.productId || item.id);
                            // Reset dropdown
                            e.target.value = "";
                          }
                        }
                      }}
                    >
                      <option value="">-- Click to select & add menu items --</option>
                      {menuCategories.map((cat, cIdx) => (
                        <optgroup key={cIdx} label={cat.name}>
                          {cat.items?.map((item: any, iIdx: number) => (
                            <option key={iIdx} value={`${cIdx}-${iIdx}`}>
                              {item.name} - ₹{item.price}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Selected Menu Items List */}
                  {selectedMenuItems.length > 0 ? (
                    <div className="space-y-1.5 pt-2 max-h-[160px] overflow-y-auto">
                      {selectedMenuItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 shadow-sm animate-in fade-in slide-in-from-top-1 duration-100">
                          <span className="truncate flex-1 pr-2">{item.name} <span className="text-slate-400 font-normal">({item.price})</span></span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, -1)}
                                className="px-2 py-0.5 hover:bg-slate-200/60 active:bg-slate-300/60 transition text-slate-500 font-bold text-xs"
                              >
                                -
                              </button>
                              <span className="px-2 w-6 text-center text-xs text-slate-800 font-mono font-bold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, 1)}
                                className="px-2 py-0.5 hover:bg-slate-200/60 active:bg-slate-300/60 transition text-slate-500 font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                            <span className="w-16 text-right font-black text-slate-800">₹{item.price * item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMenuItem(idx)}
                              className="p-1 hover:bg-red-50 text-red-500 rounded transition cursor-pointer"
                            >
                              <CloseIcon size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider font-sans">
                      Please pick items from the catalog dropdown above to build the custom order automatically
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-3 bg-amber-50/50 border border-amber-100 p-4 rounded-xl text-amber-700 text-[10px] font-bold uppercase tracking-wider font-sans">
                  ⚠️ Configure business menu catalog in settings to enable item selectors & automatic price calculations.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans" htmlFor="order-summary">
                  Order Items & Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="order-summary"
                  required
                  readOnly={menuCategories && menuCategories.length > 0}
                  rows={2}
                  placeholder={menuCategories && menuCategories.length > 0 ? "Items list is populated automatically below..." : "e.g. 2x Special Chicken Biryani, 1x Coke Large"}
                  value={newOrderSummary}
                  onChange={(e) => setNewOrderSummary(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition resize-none ${
                    menuCategories && menuCategories.length > 0
                      ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-sans select-none"
                      : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500 focus:bg-white"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans" htmlFor="order-amount">
                    Order Value (Price in ₹)
                  </label>
                  <input
                    id="order-amount"
                    type="number"
                    readOnly={menuCategories && menuCategories.length > 0}
                    placeholder={menuCategories && menuCategories.length > 0 ? "Calculated automatically" : "INR Amount (e.g. 450)"}
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:outline-none transition ${
                      menuCategories && menuCategories.length > 0
                        ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-sans select-none"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500 focus:bg-white"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans" htmlFor="order-priority">
                    Order Priority Level
                  </label>
                  <select
                    id="order-priority"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as "NORMAL" | "URGENT")}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer font-sans"
                  >
                    <option value="NORMAL">🟢 Normal (Default)</option>
                    <option value="URGENT">🔴 Urgent Dispatch (50pt Score)</option>
                  </select>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 justify-end pt-5 border-t border-app">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-slate-500 hover:bg-app-bg rounded-xl text-xs font-bold border border-app active:scale-95 transition font-sans cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition flex items-center gap-1 font-sans cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                      Registering...
                    </>
                  ) : (
                    "🚀 Record Order / Lead"
                  )}
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
