import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  ReceiptIndianRupee, 
  TrendingUp, 
  Brain, 
  Tags, 
  SlidersHorizontal, 
  Store
} from 'lucide-react';

type UserRole = 'OWNER' | 'MANAGER' | 'STAFF';

interface SidebarProps {
  merchantName: string;
  userRole: UserRole;
  gstinActive: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  merchantName = "Om Sai Silk Boutique", 
  userRole = 'OWNER', 
  gstinActive = true 
}) => {
  const [isBackOfficeMode, setIsBackOfficeMode] = useState<boolean>(false);

  // If the user is an AGENT, they CANNOT enter Back Office mode
  const canAccessBackOffice = userRole !== 'STAFF';
  
  // Logic to determine if we should show administrative features
  const showBackOfficeElements = isBackOfficeMode && canAccessBackOffice;

  const toggleMode = () => {
    if (canAccessBackOffice) {
      setIsBackOfficeMode(!isBackOfficeMode);
    }
  };

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col p-4 shadow-xl border-r border-slate-800">
      {/* Header Panel */}
      <div className="mb-8">
        <h1 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Store className="size-5" />
          {merchantName}
        </h1>
        <div className="flex gap-2 mb-3">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-900 text-indigo-200 uppercase">
            {userRole}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${gstinActive ? 'bg-emerald-900 text-emerald-200' : 'bg-rose-900 text-rose-200'}`}>
            {gstinActive ? 'GSTIN Active' : 'GSTIN Inactive'}
          </span>
        </div>
        <p className="text-xs text-slate-400">Market: D2C INDIA</p>
      </div>

      {/* Focus Mode Toggle */}
      <div className="mb-8 bg-slate-800 rounded-lg p-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-slate-200">
            {isBackOfficeMode ? 'Back Office' : 'Front Desk'}
          </span>
          <button
            onClick={toggleMode}
            disabled={!canAccessBackOffice}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isBackOfficeMode ? 'bg-indigo-600' : 'bg-slate-600'
            } ${!canAccessBackOffice ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                isBackOfficeMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {/* Core Links (Always Visible) */}
        <Link to="/chat" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
          <MessageSquare className="size-5" />
          Customer Chat Inbox
        </Link>
        <Link to="/billing" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
          <ReceiptIndianRupee className="size-5" />
          Make a Bill
        </Link>

        {/* Administrative Stacks (Conditioned by Mode & Access) */}
        {showBackOfficeElements && (
          <div className="mt-6 pt-6 border-t border-slate-700 space-y-1">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Back Office
            </p>
            <Link to="/metrics" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              <TrendingUp className="size-5" />
              Gullak Metrics
            </Link>
            <Link to="/bot-rules" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              <Brain className="size-5" />
              Bot Brain Rules
            </Link>
            <Link to="/crm-metadata" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              <Tags className="size-5" />
              Customer Labels
            </Link>
            <Link to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              <SlidersHorizontal className="size-5" />
              System Settings
            </Link>
          </div>
        )}
      </nav>
    </div>
  );
};
