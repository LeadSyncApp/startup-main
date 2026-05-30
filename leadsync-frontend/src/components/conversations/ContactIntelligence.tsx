import React, { useState } from 'react';
import { NotesPanel } from './NotesPanel';
import { getInitials, getInitialsColor, formatRelative } from './helpers';

// --- Small visual helper components ---

export const IconButton = ({ icon, onClick, title }: { icon: string; onClick?: () => void; title?: string }) => (
  <button 
    type="button"
    onClick={onClick}
    title={title}
    className="p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
  </button>
);

export const ActionCircle = ({ icon, onClick }: { icon: string; onClick?: () => void }) => (
  <button 
    type="button"
    onClick={onClick}
    className="w-10 h-10 flex items-center justify-center bg-app-surface border border-app rounded-full text-app-muted shadow-sm hover:border-blue-500 hover:text-blue-600 hover:shadow-md transition-all active:scale-90"
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
  </button>
);

export const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: string }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{title}</h4>
      {action && <button type="button" className="text-blue-600 font-bold text-xs hover:underline transition-all">{action}</button>}
    </div>
    {children}
  </div>
);

export const InfoItem = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex items-center gap-3 group cursor-pointer">
    <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-500 transition-colors text-[18px]">{icon}</span>
    <span className="text-xs text-slate-700 font-medium truncate group-hover:text-app-text transition-colors">{text}</span>
  </div>
);

// --- Contact Intelligence Panel ---

interface ContactIntelligenceProps {
  activeLead: any;
  selectedConv: any;
  onClose: () => void;
}

export const ContactIntelligence = ({ activeLead, selectedConv, onClose }: ContactIntelligenceProps) => {
  if (!selectedConv) return null;

  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');

  const leadName = activeLead?.name || selectedConv?.lead?.name || 'Customer';
  const leadContact = activeLead?.contact || selectedConv?.lead?.contact || '';
  const leadChannel = activeLead?.channel || selectedConv?.lead?.channel || 'Telegram';
  const leadInitials = getInitials(leadName, leadContact);
  const initialsColor = getInitialsColor(leadName);

  return (
    <aside className="w-[300px] bg-app-surface border-l border-app shadow-xl md:shadow-none flex flex-col shrink-0 absolute md:relative right-0 top-0 bottom-0 h-full z-20">
      <div className="absolute top-4 right-4 z-10">
        <button 
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-app-muted hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center border border-app bg-app-surface"
          title="Close profile"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="p-8 flex flex-col items-center text-center border-b border-app bg-app-bg/30 shrink-0">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-lg mb-4 bg-gradient-to-br ${initialsColor}`}>
          {leadInitials}
        </div>
        <h3 className="text-lg font-extrabold text-app-text leading-tight">{leadName}</h3>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {activeLead?.segment || 'Regular Lead'} • <span className="text-blue-600 font-semibold">{leadChannel}</span>
        </p>
        
        <div className="flex gap-2.5 mt-5">
          <ActionCircle icon="mail" onClick={() => window.open(`mailto:${activeLead?.email || ''}`)} />
          <ActionCircle icon="call" onClick={() => window.open(`tel:${leadContact}`)} />
        </div>
      </div>

      {/* Tab bar switch */}
      <div className="flex border-b border-app bg-app-bg/50 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'details'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">info</span>
          <span>Lead Profile</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'notes'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">sticky_note</span>
          <span>Internal Notes</span>
        </button>
      </div>

      {activeTab === 'details' ? (
        <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
          <Section title="Contact Details">
            <div className="space-y-3.5">
              <InfoItem icon="call" text={leadContact || "No number synchronized"} />
              <InfoItem icon="mail" text={activeLead?.email || "No email synchronized"} />
              <InfoItem icon="database" text={`ID: ${activeLead?.id || selectedConv?.lead?.id || selectedConv?.id || ''}`} />
            </div>
          </Section>

          {activeLead?.segment && (
            <Section title="Segmentation">
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  activeLead.segment === "VIP" ? "bg-amber-50 text-amber-700 border-amber-100" :
                  activeLead.segment === "CHURN_RISK" ? "bg-red-50 text-red-700 border-red-100" :
                  "bg-blue-50 text-blue-700 border-blue-100"
                }`}>
                  {activeLead.segment} SEGMENT
                </span>
                {activeLead.priority && (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    activeLead.priority === "URGENT" ? "bg-rose-50 text-rose-700 border-rose-100" :
                    activeLead.priority === "HIGH" ? "bg-orange-50 text-orange-700 border-orange-100" :
                    "bg-app-bg text-app-muted border-app"
                  }`}>
                    Priority: {activeLead.priority}
                  </span>
                )}
              </div>
            </Section>
          )}

          <Section title="Intelligence Metrics">
            <div className="space-y-1">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500">AI Score</span>
                <span className="text-xs text-app-text font-bold">{activeLead?.aiScore ?? 75} / 100</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500">Transaction Count</span>
                <span className="text-xs text-app-text font-bold">{activeLead?.orderCount ?? 0} orders</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500">Value (CRM)</span>
                <span className="text-xs text-app-text font-bold">₹{(activeLead?.totalSpend ?? 0).toLocaleString()}</span>
              </div>
              {activeLead?.suggestedAction && (
                <div className="flex justify-between py-2">
                  <span className="text-xs text-slate-500">Suggested Action</span>
                  <span className="text-xs text-blue-600 font-bold">{activeLead.suggestedAction}</span>
                </div>
              )}
            </div>
          </Section>

          {activeLead?.lastActiveAt && (
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
              <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2">Last Customer Activity</h4>
              <div className="flex gap-3">
                <div className="w-1 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>
                <div>
                  <p className="text-xs text-slate-800 font-semibold leading-relaxed truncate max-w-[180px]">
                    {activeLead.lastMessage || "Logged interaction"}
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                    {formatRelative(activeLead.lastActiveAt)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden h-full">
          <NotesPanel conversationId={selectedConv.id} />
        </div>
      )}
    </aside>
  );
};
