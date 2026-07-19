import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Mail, Smartphone, X, Loader2,
  RefreshCw, Power, PowerOff, Trash2, MoreHorizontal,
  MessageSquare, ShoppingBag, Search, UserCheck, Clock,
  UserX, Calendar, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../auth-tenancy/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { can, getRoleLabel, getRoleIcon, getRoleColor, Role } from "../../lib/permissions";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

// Types
interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  staffId: string | null;
  phoneNumber: string | null;
  isAvailable: boolean;
  isOnline: boolean;
  isActive: boolean;
  lastSeenAt: string | null;
  onboardingStatus: "PENDING" | "INVITE_ACCEPTED" | "ONBOARDED";
  createdAt: string;
  _count: {
    assignedConversations: number;
    processedOrders: number;
  };
}

interface OnboardedMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  staffId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  inviteSentAt: string | null;
}

interface PendingMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  staffId: string | null;
  createdAt: string;
  inviteSentAt: string | null;
  invitationId: string | null;
}

type Tab = "directory" | "onboarding" | "activity";

export function TeamMembersPage() {
  const { user, company } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("directory");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [onboarded, setOnboarded] = useState<OnboardedMember[]>([]);
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MANAGER" | "STAFF">("STAFF");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = useState<{ id: string; email: string } | null>(null);

  // Search filters
  const [directorySearch, setDirectorySearch] = useState("");
  const [onboardingSearch, setOnboardingSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [onboardingSubTab, setOnboardingSubTab] = useState<"onboarded" | "pending">("onboarded");

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/team/members");
      if (res.data?.members) {
        setMembers(res.data.members);
      }
    } catch (error: any) {
      console.error("Failed to fetch team members:", error);
      if (error?.response?.status !== 403) {
        toast.error("Failed to load team members");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOnboardingSummary = async () => {
    setIsLoadingOnboarding(true);
    try {
      const res = await apiClient.get("/team/onboarding-summary");
      if (res.data) {
        setOnboarded(res.data.onboarded || []);
        setPending(res.data.pending || []);
      }
    } catch (error: any) {
      console.error("Failed to fetch onboarding summary:", error);
      toast.error("Failed to load onboarding data");
    } finally {
      setIsLoadingOnboarding(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    if (activeTab === "onboarding") {
      fetchOnboardingSummary();
    }
  }, [activeTab]);

  const handleToggleAvailability = async (memberId: string) => {
    setTogglingId(memberId);
    try {
      const res = await apiClient.patch("/team/availability");
      setMembers(prev =>
        prev.map(m =>
          m.id === memberId
            ? { ...m, isAvailable: res.data.isAvailable }
            : m
        )
      );
      toast.success(res.data.message);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to toggle availability");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSendInvite = async (method: "WhatsApp" | "Email") => {
    if (!inviteEmail.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }

    setIsSendingInvite(true);
    try {
      const res = await apiClient.post("/team/invitations", {
        email: inviteEmail,
        role: inviteRole,
      });

      const { inviteUrl, staffId } = res.data.invitation;

      if (method === "WhatsApp") {
        const text = `Hi! You've been invited to join ${company?.name || "our shop"} on LeadSync as ${inviteRole.toLowerCase()}. Your Staff ID: ${staffId}. Click here to accept: ${inviteUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }

      toast.success(res.data.message);
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("STAFF");
      fetchMembers();
      if (activeTab === "onboarding") fetchOnboardingSummary();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send invitation");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const triggerRemoveMember = async () => {
    if (!memberToRemove) return;
    const { id, name } = memberToRemove;
    try {
      await apiClient.post(`/team/members/${id}/remove`);
      toast.success(`${name} has been removed from the team`);
      fetchMembers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to remove member");
    } finally {
      setMemberToRemove(null);
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    setMemberToRemove({ id: memberId, name: memberName });
  };

  const handleChangeRole = async (memberId: string, newRole: Role) => {
    try {
      const res = await apiClient.patch(`/team/members/${memberId}/role`, { role: newRole });
      toast.success(res.data.message);
      fetchMembers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to change role");
    }
  };

  const triggerRevokeInvite = async () => {
    if (!inviteToRevoke) return;
    const { id, email } = inviteToRevoke;
    setRevokingId(id);
    try {
      await apiClient.post(`/team/invitations/${id}/revoke`);
      toast.success(`Invitation revoked for ${email}`);
      fetchOnboardingSummary();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to revoke invitation");
    } finally {
      setRevokingId(null);
      setInviteToRevoke(null);
    }
  };

  const handleRevokeInvite = (invitationId: string, email: string) => {
    setInviteToRevoke({ id: invitationId, email });
  };

  const getStatusIndicator = (member: TeamMember) => {
    if (!member.isActive) {
      return { color: "var(--app-text-muted)", label: "Awaiting Acceptance", pulse: false };
    }
    if (!member.isOnline) {
      return { color: "var(--text-muted)", label: "Offline", pulse: false };
    }
    if (member.isAvailable) {
      return { color: "var(--success-green)", label: "Online & Available", pulse: true };
    }
    return { color: "var(--warning-amber)", label: "Online (Busy)", pulse: true };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  };

  // Computed lists
  const activeMembers = members.filter(m => m.isActive);
  const filteredDirectory = activeMembers.filter(m => {
    const q = directorySearch.toLowerCase();
    return (
      m.firstName?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.staffId?.toLowerCase().includes(q)
    );
  });

  const filteredOnboarded = onboarded.filter(m => {
    const q = onboardingSearch.toLowerCase();
    return (
      m.firstName?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const filteredPending = pending.filter(m => {
    const q = onboardingSearch.toLowerCase();
    return m.email.toLowerCase().includes(q);
  });

  const filteredActivity = activeMembers.filter(m => {
    const q = activitySearch.toLowerCase();
    return (
      m.firstName?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const tabConfig: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "directory", label: "Staff List", icon: <Users className="h-4 w-4" /> },
    { key: "onboarding", label: "Onboarding", icon: <UserCheck className="h-4 w-4" /> },
    { key: "activity", label: "Activity", icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ backgroundColor: 'rgba(212, 168, 67, 0.12)', color: 'var(--brand-saffron)' }}>
              Team Management
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
            Team Members
          </h1>
          <p className="font-medium text-lg" style={{ color: 'var(--text-secondary)' }}>
            Manage your staff, invitations, and performance at a glance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (activeTab === "onboarding") fetchOnboardingSummary();
              else fetchMembers();
            }}
            className="p-3.5 rounded-2xl"
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading || isLoadingOnboarding ? 'animate-spin text-saffron' : ''}`} />
          </Button>
          {can(user?.role, "team.invite") && (
            <Button
              variant="primary"
              onClick={() => setIsInviteModalOpen(true)}
              className="px-6 py-3.5 text-xs tracking-[0.1em] uppercase rounded-xl"
            >
              <UserPlus className="h-4.5 w-4.5 mr-2" />
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 mb-6 p-1.5 rounded-2xl"
           style={{ backgroundColor: 'var(--app-bg-soft)', border: '1px solid var(--app-border)' }}>
        {tabConfig.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
              activeTab === tab.key ? '' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--app-surface)' : 'transparent',
              color: activeTab === tab.key ? 'var(--brand-saffron)' : 'var(--app-text-muted)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.key === "onboarding" && pending.length > 0 && (
              <span className="flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-black"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================================
          TAB 1: TEAM DIRECTORY
          ================================ */}
      {activeTab === "directory" && (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(212, 168, 67, 0.1)', color: 'var(--brand-saffron)' }}>
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-black" style={{ color: 'var(--app-text)' }}>{activeMembers.length}</div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Staff</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-green)' }}>
                <Power className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-black" style={{ color: 'var(--app-text)' }}>
                  {activeMembers.filter(m => m.isOnline && m.isAvailable).length}
                </div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Online Now</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-black" style={{ color: 'var(--app-text)' }}>
                  {activeMembers.reduce((sum, m) => sum + m._count.assignedConversations, 0)}
                </div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Active Conversations</div>
              </div>
            </Card>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: 'var(--app-text-muted)' }} />
            <input
              type="text"
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              placeholder="Search by name, email, or staff ID..."
              className="w-full text-sm font-bold rounded-xl px-12 py-3.5 outline-none transition-all"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                border: '2px solid var(--app-border)',
                color: 'var(--app-text)',
              }}
            />
          </div>

          {/* Directory Table */}
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-saffron)' }} />
              </div>
            ) : filteredDirectory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Users className="h-16 w-16" style={{ color: 'var(--app-text-muted)' }} />
                <div className="text-xl font-black" style={{ color: 'var(--text-secondary)' }}>
                  {directorySearch ? "No members match your search" : "No active team members yet"}
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                  {directorySearch ? "Try a different search term." : "Start by inviting your staff to collaborate."}
                </p>
                {!directorySearch && can(user?.role, "team.invite") && (
                  <Button variant="primary" onClick={() => setIsInviteModalOpen(true)}
                          className="px-6 py-3.5 text-xs tracking-[0.1em] uppercase rounded-xl mt-2">
                    <UserPlus className="h-4.5 w-4.5 mr-2" />
                    Invite Your First Member
                  </Button>
                )}
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--app-bg-soft)' }}>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Member</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Role</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Contact</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Staff ID</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Last Seen</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-right"
                          style={{ color: 'var(--app-text-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                    {filteredDirectory.map((member) => {
                      const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
                      const initial = (member.firstName || "?").charAt(0).toUpperCase();
                      return (
                        <tr key={member.id} className="group transition-all"
                            style={{ backgroundColor: member.id === user?.id ? 'rgba(212, 168, 67, 0.03)' : 'transparent' }}>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-4">
                              <div className="h-11 w-11 rounded-xl border-2 flex items-center justify-center text-sm font-black"
                                   style={{
                                     backgroundColor: 'var(--app-surface)',
                                     borderColor: 'var(--app-border)',
                                     color: 'var(--app-text)'
                                   }}>
                                {initial}
                              </div>
                              <div>
                                <div className="text-base font-black leading-tight flex items-center gap-2"
                                     style={{ color: 'var(--app-text)' }}>
                                  {name || "Pending Setup"}
                                  {member.id === user?.id && (
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                                          style={{ backgroundColor: 'rgba(212, 168, 67, 0.1)', color: 'var(--brand-saffron)' }}>
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black uppercase tracking-[0.1em]"
                                  style={{
                                    backgroundColor: `${getRoleColor(member.role)}15`,
                                    borderColor: `${getRoleColor(member.role)}30`,
                                    color: getRoleColor(member.role),
                                  }}>
                              {getRoleIcon(member.role)} {getRoleLabel(member.role)}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                              {member.phoneNumber || "—"}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            {member.staffId ? (
                              <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-md"
                                    style={{ backgroundColor: 'rgba(212, 168, 67, 0.08)', color: 'var(--brand-saffron)' }}>
                                {member.staffId}
                              </span>
                            ) : (
                              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td className="py-5 px-6">
                            <span className="text-[11px] font-medium" style={{ color: member.isOnline ? 'var(--success-green)' : 'var(--app-text-muted)' }}>
                              {formatRelative(member.lastSeenAt)}
                            </span>
                          </td>
                          <td className="py-5 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {can(user?.role, "team.changeRole") && member.id !== user?.id && member.role !== "OWNER" && (
                                <div className="relative group">
                                  <button className="p-2 rounded-xl transition-all cursor-pointer"
                                          style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-xl border z-50 hidden group-hover:block"
                                       style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                    <div className="p-2 space-y-1">
                                      <button onClick={() => handleChangeRole(member.id, "MANAGER")}
                                              className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-opacity-10 cursor-pointer"
                                              style={{ color: 'var(--app-text)' }}>
                                        ⚙️ Promote to Manager
                                      </button>
                                      <button onClick={() => handleChangeRole(member.id, "STAFF")}
                                              className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-opacity-10 cursor-pointer"
                                              style={{ color: 'var(--app-text)' }}>
                                        🛠️ Demote to Staff
                                      </button>
                                      <hr style={{ borderColor: 'var(--app-border)' }} />
                                      <button onClick={() => handleRemoveMember(member.id, name)}
                                              className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-opacity-10 cursor-pointer"
                                              style={{ color: '#ef4444' }}>
                                        <Trash2 className="h-3.5 w-3.5 inline mr-1.5" />
                                        Remove from Team
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ================================
          TAB 2: ONBOARDING STATUS
          ================================ */}
      {activeTab === "onboarding" && (
        <>
          {/* Sub-tab navigation */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setOnboardingSubTab("onboarded")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
                onboardingSubTab === "onboarded" ? '' : 'opacity-60 hover:opacity-100'
              }`}
              style={{
                backgroundColor: onboardingSubTab === "onboarded" ? 'var(--app-surface)' : 'var(--app-bg-soft)',
                color: onboardingSubTab === "onboarded" ? 'var(--success-green)' : 'var(--app-text-muted)',
                border: `1px solid ${onboardingSubTab === "onboarded" ? 'rgba(34, 197, 94, 0.3)' : 'var(--app-border)'}`,
                boxShadow: onboardingSubTab === "onboarded" ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Onboarded
              <span className="flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[9px] font-black"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--success-green)' }}>
                {onboarded.length}
              </span>
            </button>
            <button
              onClick={() => setOnboardingSubTab("pending")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
                onboardingSubTab === "pending" ? '' : 'opacity-60 hover:opacity-100'
              }`}
              style={{
                backgroundColor: onboardingSubTab === "pending" ? 'var(--app-surface)' : 'var(--app-bg-soft)',
                color: onboardingSubTab === "pending" ? '#f59e0b' : 'var(--app-text-muted)',
                border: `1px solid ${onboardingSubTab === "pending" ? 'rgba(245, 158, 11, 0.3)' : 'var(--app-border)'}`,
                boxShadow: onboardingSubTab === "pending" ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <AlertCircle className="h-4 w-4" />
              Pending
              {pending.length > 0 && (
                <span className="flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[9px] font-black"
                      style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                  {pending.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: 'var(--app-text-muted)' }} />
            <input
              type="text"
              value={onboardingSearch}
              onChange={(e) => setOnboardingSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full text-sm font-bold rounded-xl px-12 py-3.5 outline-none transition-all"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                border: '2px solid var(--app-border)',
                color: 'var(--app-text)',
              }}
            />
          </div>

          {isLoadingOnboarding ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-saffron)' }} />
            </div>
          ) : onboardingSubTab === "onboarded" ? (
            /* --- Onboarded Members Table --- */
            <Card className="overflow-hidden">
              <div className="p-5 flex items-center gap-3"
                   style={{ backgroundColor: 'var(--app-bg-soft)', borderBottom: '1px solid var(--app-border)' }}>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-green)' }}>
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black" style={{ color: 'var(--app-text)' }}>Onboarded Members</div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                    {filteredOnboarded.length} member{filteredOnboarded.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="w-full overflow-x-auto">
                {filteredOnboarded.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <UserCheck className="h-12 w-12" style={{ color: 'var(--app-text-muted)' }} />
                    <div className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                      {onboardingSearch ? "No results" : "No members have onboarded yet"}
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--app-bg-soft)' }}>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Staff</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Role</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Date Joined</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Staff ID</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                      {filteredOnboarded.map((m) => {
                        const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email;
                        const initial = (m.firstName || m.email.charAt(0)).toUpperCase();
                        return (
                          <tr key={m.id} className="group transition-all">
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                                     style={{ backgroundColor: `${getRoleColor(m.role)}15`, color: getRoleColor(m.role) }}>
                                  {initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-black truncate" style={{ color: 'var(--app-text)' }}>
                                    {name}
                                  </div>
                                  <div className="text-[10px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                                    {m.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-[0.1em]"
                                    style={{ backgroundColor: `${getRoleColor(m.role)}15`, borderColor: `${getRoleColor(m.role)}30`, color: getRoleColor(m.role) }}>
                                {getRoleLabel(m.role)}
                              </span>
                            </td>
                            <td className="py-4 px-5">
                              <span className="text-[11px] font-bold flex items-center gap-1.5"
                                    style={{ color: 'var(--success-green)' }}>
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(m.acceptedAt || m.createdAt)}
                              </span>
                            </td>
                            <td className="py-4 px-5">
                              {m.staffId ? (
                                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-md"
                                      style={{ backgroundColor: 'rgba(212, 168, 67, 0.08)', color: 'var(--brand-saffron)' }}>
                                  {m.staffId}
                                </span>
                              ) : (
                                <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>—</span>
                              )}
                            </td>
                            <td className="py-4 px-5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-[0.1em]"
                                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-green)' }}>
                                <CheckCircle2 className="h-3 w-3" />
                                Active
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          ) : (
            /* --- Pending Invites Table --- */
            <Card className="overflow-hidden">
              <div className="p-5 flex items-center gap-3"
                   style={{ backgroundColor: 'var(--app-bg-soft)', borderBottom: '1px solid var(--app-border)' }}>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black" style={{ color: 'var(--app-text)' }}>Pending Invites</div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                    {filteredPending.length} pending invite{filteredPending.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="w-full overflow-x-auto">
                {filteredPending.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <UserX className="h-12 w-12" style={{ color: 'var(--app-text-muted)' }} />
                    <div className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                      {onboardingSearch ? "No results" : "No pending invitations"}
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--app-bg-soft)' }}>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Email</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Role</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Date Sent</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Staff ID</th>
                        <th className="py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em]"
                            style={{ color: 'var(--app-text-muted)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                      {filteredPending.map((m) => (
                        <tr key={m.id} className="group transition-all">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                                   style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                {m.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-black truncate" style={{ color: 'var(--app-text)' }}>
                                  {m.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-[0.1em]"
                                  style={{ backgroundColor: `${getRoleColor(m.role)}15`, borderColor: `${getRoleColor(m.role)}30`, color: getRoleColor(m.role) }}>
                              {getRoleLabel(m.role)}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <span className="text-[11px] font-bold flex items-center gap-1.5"
                                  style={{ color: 'var(--warning-amber)' }}>
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(m.inviteSentAt || m.createdAt)}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            {m.staffId ? (
                              <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-md"
                                    style={{ backgroundColor: 'rgba(212, 168, 67, 0.08)', color: 'var(--brand-saffron)' }}>
                                {m.staffId}
                              </span>
                            ) : (
                              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            {can(user?.role, "team.invite.revoke") && m.invitationId && (
                              <button
                                onClick={() => handleRevokeInvite(m.invitationId!, m.email)}
                                disabled={revokingId === m.invitationId}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all cursor-pointer disabled:opacity-50"
                                style={{ border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.06)' }}
                                title="Revoke invitation"
                              >
                                {revokingId === m.invitationId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ================================
          TAB 3: STAFF ACTIVITY
          ================================ */}
      {activeTab === "activity" && (
        <>
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: 'var(--app-text-muted)' }} />
            <input
              type="text"
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full text-sm font-bold rounded-xl px-12 py-3.5 outline-none transition-all"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                border: '2px solid var(--app-border)',
                color: 'var(--app-text)',
              }}
            />
          </div>

          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-saffron)' }} />
              </div>
            ) : filteredActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Clock className="h-16 w-16" style={{ color: 'var(--app-text-muted)' }} />
                <div className="text-xl font-black" style={{ color: 'var(--text-secondary)' }}>
                  {activitySearch ? "No members match your search" : "No active team members"}
                </div>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--app-bg-soft)' }}>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Member</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Status</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Workload</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: 'var(--app-text-muted)' }}>Last Seen</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-right"
                          style={{ color: 'var(--app-text-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                    {filteredActivity.map((member) => {
                      const status = getStatusIndicator(member);
                      const name = `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Pending Setup";
                      const initial = (member.firstName || "?").charAt(0).toUpperCase();

                      return (
                        <tr key={member.id} className="group transition-all"
                            style={{ backgroundColor: member.id === user?.id ? 'rgba(212, 168, 67, 0.03)' : 'transparent' }}>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-4">
                              <div className="h-11 w-11 rounded-xl border-2 flex items-center justify-center text-sm font-black transition-all"
                                   style={{
                                     backgroundColor: 'var(--app-surface)',
                                     borderColor: member.isOnline ? 'var(--success-green)' : 'var(--app-border)',
                                     color: 'var(--app-text)'
                                   }}>
                                {initial}
                              </div>
                              <div>
                                <div className="text-base font-black leading-tight flex items-center gap-2"
                                     style={{ color: 'var(--app-text)' }}>
                                  {name}
                                  {member.id === user?.id && (
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                                          style={{ backgroundColor: 'rgba(212, 168, 67, 0.1)', color: 'var(--brand-saffron)' }}>
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.1em]"
                                        style={{ backgroundColor: `${getRoleColor(member.role)}15`, color: getRoleColor(member.role) }}>
                                    {getRoleLabel(member.role)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full"
                                    style={{
                                      backgroundColor: status.color,
                                      animation: status.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
                                    }} />
                              <span className="text-[11px] font-bold" style={{ color: status.color }}>
                                {status.label}
                              </span>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-3 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3.5 w-3.5" />
                                {member._count.assignedConversations}
                              </span>
                              <span className="flex items-center gap-1">
                                <ShoppingBag className="h-3.5 w-3.5" />
                                {member._count.processedOrders}
                              </span>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                              {formatRelative(member.lastSeenAt)}
                            </span>
                          </td>
                          <td className="py-5 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Availability Toggle — only for self */}
                              {member.id === user?.id && (
                                <button
                                  onClick={() => handleToggleAvailability(member.id)}
                                  disabled={togglingId === member.id}
                                  className="p-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                                  style={{
                                    backgroundColor: member.isAvailable ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                    border: `1px solid ${member.isAvailable ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                    color: member.isAvailable ? 'var(--success-green)' : 'var(--warning-amber)',
                                  }}
                                  title={member.isAvailable ? "Go offline" : "Go online"}
                                >
                                  {togglingId === member.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : member.isAvailable ? (
                                    <Power className="h-4 w-4" />
                                  ) : (
                                    <PowerOff className="h-4 w-4" />
                                  )}
                                </button>
                              )}

                              {/* Owner actions */}
                              {can(user?.role, "team.changeRole") && member.id !== user?.id && member.role !== "OWNER" && (
                                <div className="relative group">
                                  <button className="p-2 rounded-xl transition-all cursor-pointer"
                                          style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-xl border z-50 hidden group-hover:block"
                                       style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                    <div className="p-2 space-y-1">
                                      <button onClick={() => handleChangeRole(member.id, "MANAGER")}
                                              className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-opacity-10 cursor-pointer"
                                              style={{ color: 'var(--app-text)' }}>
                                        ⚙️ Promote to Manager
                                      </button>
                                      <button onClick={() => handleChangeRole(member.id, "STAFF")}
                                              className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-opacity-10 cursor-pointer"
                                              style={{ color: 'var(--app-text)' }}>
                                        🛠️ Demote to Staff
                                      </button>
                                      <hr style={{ borderColor: 'var(--app-border)' }} />
                                      <button onClick={() => handleRemoveMember(member.id, name)}
                                              className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-opacity-10 cursor-pointer"
                                              style={{ color: '#ef4444' }}>
                                        <Trash2 className="h-3.5 w-3.5 inline mr-1.5" />
                                        Remove from Team
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Invite Modal (unchanged) */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 backdrop-blur-md"
              style={{ backgroundColor: 'var(--app-backdrop)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="relative w-full max-w-xl rounded-[2.5rem] shadow-[0_48px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col z-10"
              style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <div className="p-8 flex justify-between items-center"
                   style={{ borderBottom: '1px solid var(--app-border)', backgroundColor: 'var(--app-bg-soft)' }}>
                <div>
                  <h3 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                    Invite Team Member
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--app-text-muted)' }}>
                    They'll receive a link to set up their account
                  </p>
                </div>
                <button onClick={() => setIsInviteModalOpen(false)}
                        className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                        style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full text-sm font-bold rounded-xl px-5 py-3.5 outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      border: '2px solid var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--app-text-muted)' }}>
                    Authority Level
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full text-sm font-black rounded-xl px-4 py-3.5 outline-none transition-all appearance-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      border: '2px solid var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <option value="STAFF">Standard Staff (Chat & Orders only)</option>
                    <option value="MANAGER">Shop Manager (Full Operations)</option>
                  </select>
                </div>
              </div>

              <div className="p-8 flex items-center gap-4"
                   style={{ backgroundColor: 'var(--brand-navy)' }}>
                <button
                  onClick={() => handleSendInvite("WhatsApp")}
                  disabled={isSendingInvite}
                  className="flex-1 py-4 text-white font-black text-[10px] tracking-wider uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <Smartphone className="h-4.5 w-4.5" />
                  {isSendingInvite ? "Sending..." : "WhatsApp Invite"}
                </button>
                <Button
                  variant="secondary"
                  onClick={() => handleSendInvite("Email")}
                  disabled={isSendingInvite}
                  className="flex-1 py-4 text-xs font-black tracking-wider uppercase rounded-xl shadow-md"
                >
                  <Mail className="h-4.5 w-4.5 mr-2" />
                  {isSendingInvite ? "Sending..." : "Email"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={triggerRemoveMember}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${memberToRemove?.name} from the team?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        isDestructive={true}
      />

      <ConfirmDialog
        isOpen={!!inviteToRevoke}
        onClose={() => setInviteToRevoke(null)}
        onConfirm={triggerRevokeInvite}
        title="Revoke Invitation"
        message={`Are you sure you want to revoke the invitation for ${inviteToRevoke?.email}?`}
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
}