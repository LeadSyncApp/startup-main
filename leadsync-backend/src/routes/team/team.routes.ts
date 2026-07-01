import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware } from "../../middleware/auth.middleware";
import { can } from "../../services/auth/permissions.service";
import { notificationService } from "../../services/infrastructure/notification.service";

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

const router = Router();

/* =====================================================
   List Team Members
   GET /api/team/members
===================================================== */
router.get("/members", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!can(userRole, "team.viewOwn")) {
      return res.status(403).json({ message: "Access denied" });
    }

    const members = await prisma.user.findMany({
      where: { companyId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
        phoneNumber: true,
        isAvailable: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
        isActive: true,
        onboardingStatus: true,
            _count: {
              select: {
                claimedConversations: true,
                processedOrders: true,
              },
            },
      },
    });

    // Override isOnline with staleness check:
    // If lastSeenAt is older than 2 minutes, treat as offline regardless of DB flag
    const now = new Date();
    const correctedMembers = members.map((m) => {
      let isOnline = m.isOnline;
      if (m.lastSeenAt) {
        const elapsed = now.getTime() - new Date(m.lastSeenAt).getTime();
        if (elapsed > STALE_THRESHOLD_MS) {
          isOnline = false;
        }
      } else if (m.isOnline) {
        // No lastSeenAt but marked online — treat as stale
        isOnline = false;
      }
      return { ...m, isOnline };
    });

    res.json({ members: correctedMembers });
  } catch (error: any) {
    console.error("List team members error:", error);
    res.status(500).json({ message: "Failed to list team members" });
  }
});

/* =====================================================
   Get Single Team Member Details
   GET /api/team/members/:id
===================================================== */
router.get("/members/:id", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const member = await prisma.user.findFirst({
      where: { id, companyId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
        phoneNumber: true,
        residingAddress: true,
        isAvailable: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
        _count: {
          select: {
            claimedConversations: true,
            processedOrders: true,
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    // Apply staleness check on isOnline
    const now = new Date();
    let isOnline = member.isOnline;
    if (member.lastSeenAt) {
      const elapsed = now.getTime() - new Date(member.lastSeenAt).getTime();
      if (elapsed > STALE_THRESHOLD_MS) {
        isOnline = false;
      }
    } else if (member.isOnline) {
      isOnline = false;
    }

    res.json({ member: { ...member, isOnline } });
  } catch (error: any) {
    console.error("Get team member error:", error);
    res.status(500).json({ message: "Failed to get team member" });
  }
});

/* =====================================================
   Update Team Member Role
   PATCH /api/team/members/:id/role
   Requires: OWNER only
===================================================== */
router.patch("/members/:id/role", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;
    const { role: newRole } = req.body;

    if (!can(userRole, "team.changeRole")) {
      return res.status(403).json({ message: "Only the Owner can change roles" });
    }

    if (!["OWNER", "MANAGER", "STAFF"].includes(newRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Cannot change the OWNER's role
    const targetUser = await prisma.user.findFirst({
      where: { id, companyId },
    });

    if (!targetUser) {
      return res.status(404).json({ message: "Team member not found" });
    }

    if (targetUser.role === "OWNER") {
      return res.status(403).json({ message: "Cannot change the Owner's role" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
      },
    });

    await notificationService.notifyUser(
      id,
      "🔄 Role Updated",
      `Your role has been changed to ${newRole}`,
      "SYSTEM"
    );

    res.json({ message: "Role updated successfully", member: updated });
  } catch (error: any) {
    console.error("Update team member role error:", error);
    res.status(500).json({ message: "Failed to update role" });
  }
});

/* =====================================================
   Remove Team Member
   POST /api/team/members/:id/remove
   Requires: OWNER only
===================================================== */
router.post("/members/:id/remove", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;
    const adminUserId = req.user?.userId;

    if (!can(userRole, "team.remove")) {
      return res.status(403).json({ message: "Only the Owner can remove team members" });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id, companyId },
    });

    if (!targetUser) {
      return res.status(404).json({ message: "Team member not found" });
    }

    if (targetUser.role === "OWNER") {
      return res.status(403).json({ message: "Cannot remove the Owner" });
    }

    if (id === adminUserId) {
      return res.status(403).json({ message: "You cannot remove yourself" });
    }

    // Soft-deactivate instead of delete
    await prisma.user.update({
      where: { id },
      data: { isActive: false, isOnline: false },
    });

    // Unassign any conversations
    await prisma.conversation.updateMany({
      where: { claimedById: id },
      data: { claimedById: null, status: "OPEN" },
    });

    // Notify other admins
    const adminName = req.user?.firstName || "An admin";
    const memberName = `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim();
    await notificationService.notifyCompanyAdmins(
      companyId,
      "🚫 Team Member Removed",
      `${memberName} was removed by ${adminName}`,
      "SYSTEM"
    );

    res.json({ message: "Team member removed successfully" });
  } catch (error: any) {
    console.error("Remove team member error:", error);
    res.status(500).json({ message: "Failed to remove team member" });
  }
});

/* =====================================================
   Toggle My Availability
   PATCH /api/team/availability
===================================================== */
router.patch("/availability", authMiddleware as any, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAvailable: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isAvailable: !user.isAvailable },
      select: {
        id: true,
        isAvailable: true,
        isOnline: true,
      },
    });

    // Notify company about availability change
    const { emitToCompany } = await import("../../lib/socket.js");
    emitToCompany(companyId, "user_availability_changed", {
      userId,
      isAvailable: updated.isAvailable,
    });

    res.json({
      message: updated.isAvailable ? "You're now available for orders" : "You've gone offline for orders",
      isAvailable: updated.isAvailable,
    });
  } catch (error: any) {
    console.error("Toggle availability error:", error);
    res.status(500).json({ message: "Failed to toggle availability" });
  }
});

/* =====================================================
   Get My Stats
   GET /api/team/my-stats
===================================================== */
router.get("/my-stats", authMiddleware as any, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    const [conversations, orders] = await Promise.all([
      prisma.conversation.count({
        where: { claimedById: userId, status: { not: "RESOLVED" } },
      }),
      prisma.order.count({
        where: { processedById: userId, status: { notIn: ["DELIVERED", "CANCELLED"] } },
      }),
    ]);

    res.json({
      stats: {
        activeConversations: conversations,
        pendingOrders: orders,
      },
    });
  } catch (error: any) {
    console.error("Get my stats error:", error);
    res.status(500).json({ message: "Failed to get stats" });
  }
});

/* =====================================================
   Onboarding Summary (Onboarded + Pending Members)
   GET /api/team/onboarding-summary
   Returns members grouped by onboarding status with invitation dates
===================================================== */
router.get("/onboarding-summary", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch onboarded members (accepted invite + completed onboarding)
    const onboarded = await prisma.user.findMany({
      where: { companyId, onboardingStatus: "ONBOARDED", isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
        createdAt: true,
      },
    });

    // Fetch pending members (pre-provisioned, hasn't accepted yet)
    const pending = await prisma.user.findMany({
      where: { companyId, onboardingStatus: "PENDING", isActive: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
        createdAt: true,
      },
    });

    // For onboarded members, find the acceptedAt from their invitation
    const onboardedEmails = onboarded.map(m => m.email);
    const acceptedInvitations = onboardedEmails.length > 0
      ? await prisma.invitation.findMany({
          where: {
            companyId,
            email: { in: onboardedEmails },
            status: "ACCEPTED",
          },
          select: {
            email: true,
            acceptedAt: true,
            createdAt: true,
          },
        })
      : [];

    const acceptedMap = new Map(acceptedInvitations.map(i => [i.email, { acceptedAt: i.acceptedAt, inviteSentAt: i.createdAt }]));

    // For pending members, find the invite sent date from their invitation
    const pendingEmails = pending.map(m => m.email);
    const pendingInvitations = pendingEmails.length > 0
      ? await prisma.invitation.findMany({
          where: {
            companyId,
            email: { in: pendingEmails },
            status: "PENDING",
          },
          select: {
            email: true,
            createdAt: true,
            id: true,
          },
        })
      : [];

    const pendingMap = new Map(pendingInvitations.map(i => [i.email, { inviteSentAt: i.createdAt, invitationId: i.id }]));

    const onboardedWithDate = onboarded.map(m => ({
      ...m,
      acceptedAt: acceptedMap.get(m.email)?.acceptedAt || null,
      inviteSentAt: acceptedMap.get(m.email)?.inviteSentAt || null,
    }));

    const pendingWithDate = pending.map(m => ({
      ...m,
      inviteSentAt: pendingMap.get(m.email)?.inviteSentAt || null,
      invitationId: pendingMap.get(m.email)?.invitationId || null,
    }));

    res.json({ onboarded: onboardedWithDate, pending: pendingWithDate });
  } catch (error: any) {
    console.error("Onboarding summary error:", error);
    res.status(500).json({ message: "Failed to get onboarding summary" });
  }
});

export default router;
