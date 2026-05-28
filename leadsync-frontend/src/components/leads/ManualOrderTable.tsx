import { useState } from "react";
import { MoreVertical, Eye, User, Clipboard } from "lucide-react";
import toast from "react-hot-toast";

interface ManualOrderTableProps {
  orders: any[];
  selectedLeads: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onViewDetailedReport: (order: any) => void;
  onViewLeadReport: (order: any) => void;
}

export default function ManualOrderTable({
  orders,
  selectedLeads,
  onSelect,
  onSelectAll,
  onViewDetailedReport,
  onViewLeadReport,
}: ManualOrderTableProps) {
  const [activeDropdownOrderId, setActiveDropdownOrderId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  const isAllSelected = orders.length > 0 && selectedLeads.size === orders.length;

  return (
    <div className="bg-app-surface rounded-[20px] border border-app shadow-sm overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse select-none">
          <thead>
            <tr className="border-b border-app bg-app-bg text-app-muted font-sans text-xs uppercase font-extrabold tracking-wider">
              <th className="py-4 px-4 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-app-border-strong text-blue-600 cursor-pointer accent-blue-600 focus:ring-blue-500"
                  title="Select all"
                />
              </th>
              <th className="py-4 px-6">Customer</th>
              <th className="py-4 px-6">Order Details</th>
              <th className="py-4 px-6">Recorded By Agent</th>
              <th className="py-4 px-6">City</th>
              <th className="py-4 px-6">State</th>
              <th className="py-4 px-6 text-right">Value</th>
              <th className="py-4 px-6 text-center text-xs">Date</th>
              <th className="py-4 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans text-xs">
            {orders.map((order) => {
              const baseSummary = order.items?.baseSummary || order.summary;
              const agentName = order.items?.agentName || order.processedBy?.name || "Agent";
              const city = order.items?.city || "—";
              const state = order.items?.state || "—";
              const isSelected = selectedLeads.has(order.id);
              return (
                <tr key={order.id} className={`hover:bg-app-bg/60 transition-colors ${isSelected ? "bg-blue-50/50" : ""}`}>
                  <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelect(order.id)}
                      className="h-4 w-4 rounded border-app-border-strong text-blue-600 cursor-pointer accent-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="font-bold text-app-text text-sm">
                        {order.lead?.name || "Customer"}
                      </span>
                      <span className="text-xs text-app-muted font-semibold font-mono">
                        {order.lead?.contact}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 max-w-xs">
                    <div className="text-app-text font-semibold line-clamp-2 text-left font-sans">
                      {baseSummary}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-left">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-app-text bg-app-bg-soft border border-app rounded-lg font-bold font-sans">
                      👤 {agentName}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-left">
                    <span className="font-bold text-app-muted font-sans">
                      {city}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-left">
                    <span className="font-semibold text-app-muted font-sans">
                      {state}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-black text-app-text text-sm font-sans">
                    <div className="flex flex-col items-end gap-1">
                      <span>
                        ₹{order.amount?.toLocaleString("en-IN") || "0"}
                      </span>
                      <span className={`inline-block text-center text-[10px] font-extrabold px-2 py-0.5 rounded-full w-fit ${
                        order.priority === "URGENT" ? "bg-red-50 text-red-600 border border-red-100" : "bg-app-bg text-app-muted border border-app"
                      }`}>
                        {order.priority}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center relative whitespace-nowrap">
                    <div className="flex justify-center items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeDropdownOrderId === order.id) {
                            setActiveDropdownOrderId(null);
                            setDropdownPosition(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownPosition({
                              top: rect.bottom + 4,
                              left: rect.right - 208
                            });
                            setActiveDropdownOrderId(order.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-app-muted hover:bg-app-bg-soft rounded-xl transition active:scale-90 cursor-pointer"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>

                    {activeDropdownOrderId === order.id && (
                      <>
                        {/* Overlay to close dropdown when clicked outside */}
                        <div 
                          className="fixed inset-0 z-40 cursor-default" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownOrderId(null);
                            setDropdownPosition(null);
                          }} 
                        />
                        <div 
                          style={{
                            position: "fixed",
                            top: dropdownPosition ? `${dropdownPosition.top}px` : "auto",
                            left: dropdownPosition ? `${dropdownPosition.left}px` : "auto",
                          }}
                          className="w-52 bg-app-surface rounded-xl shadow-xl border border-app py-1.5 z-50 text-left font-sans select-none animate-in fade-in slide-in-from-top-1 duration-100"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetailedReport(order);
                              setActiveDropdownOrderId(null);
                              setDropdownPosition(null);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-bold text-app-text hover:bg-app-bg flex items-center gap-2 transition cursor-pointer"
                          >
                            <Eye size={14} className="text-blue-500" />
                            Read Detailed Report
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewLeadReport(order);
                              setActiveDropdownOrderId(null);
                              setDropdownPosition(null);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-bold text-app-text hover:bg-app-bg flex items-center gap-2 transition cursor-pointer"
                          >
                            <User size={14} className="text-indigo-500" />
                            Open CRM Lead Drawer
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = `Customer Name: ${order.lead?.name || "Customer"}\nContact: ${order.lead?.contact || ""}\nOrder Items: ${baseSummary}\nValue: ₹${order.amount || 0}\nRecorded by agent: ${agentName}`;
                              navigator.clipboard.writeText(text);
                              toast.success("📋 Order info copied!");
                              setActiveDropdownOrderId(null);
                              setDropdownPosition(null);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-bold text-app-text hover:bg-app-bg flex items-center gap-2 transition cursor-pointer"
                          >
                            <Clipboard size={14} className="text-emerald-500" />
                            Copy Order Info
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
