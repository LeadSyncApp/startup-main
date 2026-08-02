import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Settings, 
  LogOut,
  Users,
  ShoppingBag,
  Bell,
  Home,
  Zap,
  Menu,
  X,
  Sun,
  Moon,
  Inbox,
  Package,
  User
} from 'lucide-react';
import { useActivityStore } from '../../features/activity-ledger/useActivityStore';
import { ActivityFeedDrawer } from '../../features/activity-ledger/ActivityFeedDrawer';
import { useTheme } from '../../features/theme/ThemeContext';
import { useAuth } from '../../features/auth-tenancy/AuthContext';
import { authedFetch } from '../../api/client';
import { onEvent } from '../../lib/socketClient';
import { NotificationBell } from '../../features/notifications/NotificationPanel';
import { can, Permission } from '../../lib/permissions';

export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF';
export type TabID = 'shop' | 'messages' | 'inbox' | 'customers' | 'broadcast' | 'orders' | 'automation' | 'inventory' | 'settings' | 'profile';

export interface TabItem {
  id: TabID;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
  permission: Permission;
  badge?: string | number;
}

const tabConfig: TabItem[] = [
  { id: 'shop', label: 'My Shop', icon: Home, allowedRoles: ['OWNER', 'MANAGER', 'STAFF'], permission: 'dashboard.view' },
  { id: 'messages', label: 'New Customers', icon: MessageSquare, allowedRoles: ['OWNER', 'MANAGER', 'STAFF'], permission: 'conversations.reply' },
  { id: 'inbox', label: 'My Chats', icon: Inbox, allowedRoles: ['OWNER', 'MANAGER', 'STAFF'], permission: 'conversations.reply' },
  { id: 'customers', label: 'Customers', icon: Users, allowedRoles: ['OWNER', 'MANAGER'], permission: 'team.view' },
  { id: 'broadcast', label: 'Broadcast', icon: Zap, allowedRoles: ['OWNER', 'MANAGER'], permission: 'broadcast.send' },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, allowedRoles: ['OWNER', 'MANAGER', 'STAFF'], permission: 'orders.fulfill' },
  { id: 'automation', label: 'Automation', icon: MessageSquare, allowedRoles: ['OWNER', 'MANAGER'], permission: 'automation.manage' },
  { id: 'inventory', label: 'Inventory', icon: Package, allowedRoles: ['OWNER', 'MANAGER', 'STAFF'], permission: 'inventory.manage' },
  { id: 'settings', label: 'Settings', icon: Settings, allowedRoles: ['OWNER', 'MANAGER'], permission: 'settings.shop.edit' },
  { id: 'profile', label: 'My Profile', icon: User, allowedRoles: ['OWNER', 'MANAGER', 'STAFF'], permission: 'team.viewOwn' },
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
  const { companyId, company } = useAuth();
  const unreadCount = events.filter(e => !e.read).length;

  // Real badge counts — reuse the same endpoints that power InboxList
  // (filter=mine) and StreamTriage (filter=unclaimed). No new backend needed.
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  // Set of lead ids that currently have unread messages (server-authoritative base).
  const [unreadLeadIds, setUnreadLeadIds] = useState<Set<string>>(new Set());
  // The conversation currently open in the inbox detail pane (set instantly via
  // the conversation:open event). A chat that is open is being viewed live, so it
  // must never count toward the unread total — same rule as the chat row badge.
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const refreshBadgeCounts = useCallback(async () => {
    if (!companyId) return;
    try {
      // Fetch unclaimed conversations for the "New Customers" badge (StreamTriage queue) using lightweight countOnly query.
      const unclaimedRes = await authedFetch('/api/leads?filter=unclaimed&countOnly=true');
      if (unclaimedRes.ok) {
        const unclaimedJson = await unclaimedRes.json();
        setUnclaimedCount(unclaimedJson.meta?.total ?? (unclaimedJson.data?.length ?? 0));
      }

      // Fetch my assigned conversations for the "My Chats" unread badge, unless inbox page is active
      // (inbox page broadcasts its unread lead IDs directly via inbox:unread_leads to prevent duplicate fetches).
      if (activeTab !== 'inbox') {
        const mineRes = await authedFetch('/api/leads?filter=mine&limit=50');
        if (mineRes.ok) {
          const json = await mineRes.json();
          const active = (json.data || []).filter(
            (l: { status: string }) => l.status !== 'RESOLVED'
          );
          setUnreadLeadIds(
            new Set(active.filter((l: { id: string; unreadCount?: number }) => (l.unreadCount ?? 0) > 0).map((l: { id: string }) => l.id))
          );
        }
      }
    } catch {
      // Keep counts at 0 on failure; badges simply don't show.
    }
  }, [companyId, activeTab]);

  // Count of unread chats, with the currently-open conversation excluded so it
  // never shows as unread while the user is viewing it live. Updates instantly
  // whenever openLeadId changes (no server round-trip).
  const myUnreadChats = useMemo(() => Math.max(
    0,
    unreadLeadIds.size - (openLeadId && unreadLeadIds.has(openLeadId) ? 1 : 0)
  ), [unreadLeadIds, openLeadId]);

  // Initial fetch on mount; re-fetch if companyId changes
  useEffect(() => {
    refreshBadgeCounts();
  }, [refreshBadgeCounts]);

  // Fallback safety net polling: keep badge in sync if socket events are missed (e.g. WS reconnect gap).
  // Sockets handle primary real-time updates; fallback polling runs every 60s.
  useEffect(() => {
    const interval = setInterval(refreshBadgeCounts, 60_000);
    return () => clearInterval(interval);
  }, [refreshBadgeCounts]);

  // Live badge updates via socket events — debounced to batch rapid-fire events
  const badgeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleBadgeRefresh = useCallback(() => {
    if (badgeRefreshTimer.current) clearTimeout(badgeRefreshTimer.current);
    badgeRefreshTimer.current = setTimeout(refreshBadgeCounts, 400);
  }, [refreshBadgeCounts]);

  useEffect(() => {
    const handler = () => scheduleBadgeRefresh();

    const unsub1 = onEvent("conversation:new", handler);
    const unsub2 = onEvent("conversation_updated", handler);
    const unsub3 = onEvent("conversation.resolved", handler);
    const unsub4 = onEvent("lead_updated", handler);
    const unsub5 = onEvent("lead_claimed", handler);
    const unsub6 = onEvent("conversation_deleted", handler);

    // Track which conversation is currently open (broadcast by InboxSplitView).
    // The open chat is excluded from the unread count on the SAME tick it opens,
    // so the sidebar badge behaves exactly like the chat-row badge — no fetch.
    const handleOpen = (e: Event) => {
      const leadId = (e as CustomEvent<{ leadId: string | null }>).detail?.leadId ?? null;
      setOpenLeadId(leadId);
    };
    window.addEventListener("conversation:open", handleOpen);

    // Track unread leads broadcast from InboxList when activeTab === 'inbox'
    const handleInboxUnread = (e: Event) => {
      const ids = (e as CustomEvent<{ unreadLeadIds: string[] }>).detail?.unreadLeadIds;
      if (ids) {
        setUnreadLeadIds(new Set(ids));
      }
    };
    window.addEventListener("inbox:unread_leads", handleInboxUnread);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
      window.removeEventListener("conversation:open", handleOpen);
      window.removeEventListener("inbox:unread_leads", handleInboxUnread);
      if (badgeRefreshTimer.current) clearTimeout(badgeRefreshTimer.current);
    };
  }, [scheduleBadgeRefresh]);

  // Map dynamic counts onto ONLY the two tabs that should ever show a badge.
  // Other tabs keep their original (absent) badge property, exactly as before.
  const badgeFor = useMemo((): Partial<Record<string, number>> => ({
    messages: unclaimedCount > 0 ? unclaimedCount : undefined,
    inbox: myUnreadChats > 0 ? myUnreadChats : undefined,
  }), [unclaimedCount, myUnreadChats]);

  const { user } = useAuth();

  const allowedTabs = useMemo(() => tabConfig
    .filter(tab => can(user || userRole, tab.permission))
    .map(tab =>
      tab.id in badgeFor
        ? { ...tab, badge: badgeFor[tab.id] }
        : tab
    ), [user, userRole, badgeFor]);

  const displayRole = userRole === 'STAFF' ? 'Staff' : userRole === 'MANAGER' ? 'Manager' : 'Owner';

  const isConnected = gatewayStatus === 'STABLE' || gatewayStatus === 'SYNCED';

  return (
    <>
      {/* Ambient Glow Layer - Soft glow from top-left across the visual surface */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div 
          className="absolute rounded-full opacity-[var(--blob-opacity)] ambient-glow" 
          style={{ 
            width: '800px', 
            height: '800px', 
            background: 'radial-gradient(circle, var(--brand-saffron) 0%, transparent 70%)', 
            filter: 'blur(80px)', 
            top: '-200px', 
            left: '-200px' 
          }} 
        />
      </div>
    <div className="flex h-[100dvh] bg-[var(--app-bg)] overflow-hidden relative z-[1]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col h-full w-64 flex-shrink-0 bg-transparent border-r border-[var(--app-border)]">
        {/* Brand Header */}
        <div className="p-5 border-b border-[var(--app-border)]">
          <div className="flex items-center gap-3">
            <img 
              src="/salira-logo.png" 
              alt="SaLira" 
              className="h-9 w-9 rounded-lg object-contain shrink-0 btn-interactive" 
            />
              <div className="min-w-0">
               <h1 className="text-sm font-bold text-[var(--text-primary)] truncate" style={{fontFamily: "'Fraunces', serif"}}>{merchantName || company?.name || "My Business"}</h1>
               <p className="text-xs text-[var(--text-secondary)] capitalize">{displayRole}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[var(--app-border)]">
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-[var(--success-green)] pulse-live' : 'bg-[var(--danger-red)]'}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${isConnected ? 'text-[var(--success-green)]' : 'text-[var(--text-secondary)]'}`}>
              {isConnected ? 'LIVE — CONNECTED' : 'Disconnected'}
            </span>
            <div className="ml-auto">
              <NotificationBell />
            </div>
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer btn-interactive ${
                  isActive 
                    ? 'bg-[var(--brand-saffron-soft)] text-[var(--text-primary)] border-l-2 border-transparent relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[var(--brand-saffron)]' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-bg-soft)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-[var(--brand-saffron)]' : 'text-[var(--text-secondary)]'}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)]">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle + Logout */}
        <div className="p-3 border-t border-[var(--app-border)] space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--sidebar-text-muted)] hover:text-[var(--brand-saffron)] hover:bg-[var(--brand-saffron-soft)] transition-all cursor-pointer btn-interactive"
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
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--sidebar-text-muted)] hover:text-[var(--danger-red)] hover:bg-[var(--app-bg-soft)] transition-all cursor-pointer btn-interactive"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          )}
        </div>
      </aside>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--app-surface)] border-b border-[var(--app-border)] flex items-center justify-between px-4 z-30">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-[var(--app-bg-soft)] text-[var(--app-text-muted)] cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/salira-logo.png" alt="SaLira" className="h-6 w-6 rounded-md object-contain" />
          <span className="font-bold text-[var(--app-text)] text-sm">{merchantName}</span>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2 rounded-lg hover:bg-[var(--app-bg-soft)] text-[var(--app-text-muted)] relative cursor-pointer"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[var(--brand-saffron)] text-[var(--app-bg)] text-2xs font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <NotificationBell />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)} />
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            className="relative w-72 h-full bg-[var(--app-surface)] shadow-xl"
          >
            <div className="p-5 border-b border-[var(--app-border)] flex items-center justify-between">
              <span className="font-bold text-[var(--app-text)]">Menu</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1 cursor-pointer">
                <X className="h-5 w-5 text-[var(--app-text-muted)]" />
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
                      isActive ? 'bg-[var(--brand-saffron-soft)] text-[var(--text-primary)]' : 'text-[var(--app-text-muted)] hover:bg-[var(--app-bg-soft)]'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-[var(--brand-saffron)]' : 'text-[var(--app-text-muted)]'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            {onLogout && (
              <div className="p-3 border-t border-[var(--app-border)]">
                <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-[var(--app-text-muted)] hover:text-[var(--danger-red)] cursor-pointer">
                  <LogOut className="h-4 w-4" /> Log Out
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--app-surface)] border-t border-[var(--app-border)] flex justify-around items-center z-30 px-2">
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
                <Icon className={`h-5 w-5 ${isActive ? 'text-[var(--brand-saffron)]' : 'text-[var(--app-text-muted)]'}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 text-2xs font-bold w-4 h-4 rounded-full bg-[var(--brand-saffron)] text-[var(--app-bg)] flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-2xs mt-1 font-medium ${isActive ? 'text-[var(--brand-saffron)]' : 'text-[var(--app-text-muted)]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <main data-layout-main className={`flex-1 h-full min-w-0 overflow-y-auto overflow-x-hidden pt-14 md:pt-0 pb-16 md:pb-0 ${activeTab === 'inbox' || window.location.pathname.startsWith('/inbox') ? 'flex flex-col min-h-0' : ''}`}>
        <div className={`w-full min-w-0 ${activeTab === 'inbox' || window.location.pathname.startsWith('/inbox') ? 'flex-1 min-h-0 flex flex-col' : 'p-4 md:p-6 lg:p-8 max-w-7xl mx-auto'}`}>
          {children}
        </div>
      </main>

      {/* Activity Drawer */}
      <ActivityFeedDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
    </>
  );
};
