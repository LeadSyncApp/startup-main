import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Settings, 
  Store,
  LogOut,
  Users,
  ShoppingBag,
  Bell,
  Home,
  Zap,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useActivityStore } from '../../features/activity-ledger/useActivityStore';
import { ActivityFeedDrawer } from '../../features/activity-ledger/ActivityFeedDrawer';
import { useTheme } from '../../features/theme/ThemeContext';

export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF';
export type TabID = 'shop' | 'messages' | 'customers' | 'broadcast' | 'orders' | 'automation' | 'settings';

export interface TabItem {
  id: TabID;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
  badge?: string | number;
}

const tabConfig: TabItem[] = [
  { id: 'shop', label: 'My Shop', icon: Home, allowedRoles: ['OWNER', 'MANAGER'] },
  { id: 'messages', label: 'Messages', icon: MessageSquare, allowedRoles: ['OWNER', 'MANAGER', 'STAFF'], badge: '3' },
  { id: 'customers', label: 'Customers', icon: Users, allowedRoles: ['OWNER', 'MANAGER'] },
  { id: 'broadcast', label: 'Broadcast', icon: Zap, allowedRoles: ['OWNER', 'MANAGER'] },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, allowedRoles: ['OWNER', 'MANAGER'] },
  { id: 'automation', label: 'Automation', icon: MessageSquare, allowedRoles: ['OWNER', 'MANAGER'] },
  { id: 'settings', label: 'Settings', icon: Settings, allowedRoles: ['OWNER', 'MANAGER'] },
];

interface MasterDashboardLayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
  merchantName: string;
  activeTab: TabID;
  setActiveTab: (tab: TabID) => void;
  onLogout?: () => void;
}

export const MasterDashboardLayout: React.FC<MasterDashboardLayoutProps> = ({ 
  children, 
  userRole, 
  merchantName,
  activeTab,
  setActiveTab,
  onLogout
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { gatewayStatus, events } = useActivityStore();
  const { theme, toggleTheme } = useTheme();
  const unreadCount = events.filter(e => !e.read).length;

  const allowedTabs = tabConfig.filter(tab => tab.allowedRoles.includes(userRole));
  const displayRole = userRole === 'STAFF' ? 'Staff' : userRole === 'MANAGER' ? 'Manager' : 'Owner';

  const isConnected = gatewayStatus === 'STABLE' || gatewayStatus === 'SYNCED';

  return (
    <div className="flex h-screen bg-app-bg overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-app-surface border-r border-app-border">
        {/* Brand Header */}
        <div className="p-5 border-b border-app-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-navy flex items-center justify-center text-white shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-app-text truncate">{merchantName}</h1>
              <p className="text-xs text-app-text-muted capitalize">{displayRole}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-app-border">
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-app-text-muted font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allowedTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-brand-saffron-soft text-brand-navy' 
                    : 'text-app-text-muted hover:bg-app-bg-soft hover:text-app-text'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-brand-saffron' : 'text-app-text-muted'}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-saffron-soft text-brand-saffron">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle + Logout */}
        <div className="p-3 border-t border-app-border space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-app-text-muted hover:text-brand-saffron hover:bg-brand-saffron-soft transition-all cursor-pointer"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-app-text-muted hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-app-surface border-b border-app-border flex items-center justify-between px-4 z-30">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-app-bg-soft text-app-text-muted cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-brand-navy" />
          <span className="font-bold text-app-text text-sm">{merchantName}</span>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2 rounded-lg hover:bg-app-bg-soft text-app-text-muted relative cursor-pointer"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-brand-saffron text-white text-2xs font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileSidebarOpen(false)} />
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            className="relative w-72 h-full bg-app-surface shadow-xl"
          >
            <div className="p-5 border-b border-app-border flex items-center justify-between">
              <span className="font-bold text-app-text">Menu</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1 cursor-pointer">
                <X className="h-5 w-5 text-app-text-muted" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {allowedTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isActive ? 'bg-brand-saffron-soft text-brand-navy' : 'text-app-text-muted hover:bg-app-bg-soft'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-brand-saffron' : 'text-app-text-muted'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            {onLogout && (
              <div className="p-3 border-t border-app-border">
                <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-app-text-muted hover:text-red-600 cursor-pointer">
                  <LogOut className="h-4 w-4" /> Log Out
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-app-surface border-t border-app-border flex justify-around items-center z-30 px-2">
        {allowedTabs.slice(0, 5).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 cursor-pointer"
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'text-brand-navy' : 'text-app-text-muted'}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 text-2xs font-bold w-4 h-4 rounded-full bg-brand-saffron text-white flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-2xs mt-1 font-medium ${isActive ? 'text-brand-navy' : 'text-app-text-muted'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto pt-14 md:pt-0 pb-16 md:pb-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Activity Drawer */}
      <ActivityFeedDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
};