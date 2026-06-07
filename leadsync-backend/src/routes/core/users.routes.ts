import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { notificationService } from "../../services/infrastructure/notification.service";
import { emitToAgent } from "../../lib/socket";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  staffId: z.string().min(1, "Staff ID is required").max(50),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100),
  role: z.enum(["ADMIN", "AGENT"], { error: "Role must be ADMIN or AGENT" }),
  roleDefinitionId: z.string().nullable().optional(),
});

const router = Router();

// Map from internal note id to a map of emoji -> string[] of user ids who have reacted
export const inMemoryReactions = new Map<string, Record<string, string[]>>();

/* ===============================
   GET COMPACT LIST (all roles)
   Returns id + name + role + email + isActive for @mention / assignment / inbox UI
=============================== */
router.get("/list", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const users = await prisma.user.findMany({
      where: { companyId: req.user.companyId, isActive: true },
      select: { id: true, name: true, role: true, email: true, isActive: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch {
    res.status(500).json({ message: "Failed to fetch user list" });
  }
});

/* ===============================
   GET OWNER/ADMIN DASHBOARD DATA
=============================== */
router.get(
  "/owner-dashboard",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      if (!["OWNER", "ADMIN"].includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { companyId } = req.user;

      // 1. Fetch all agents/users
      const agents = await prisma.user.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isAvailable: true,
          staffId: true,
        },
        orderBy: { name: "asc" },
      });

      // 2. Fetch all conversations matching company id to build stats
      const conversations = await prisma.conversation.findMany({
        where: { companyId },
        include: {
          lead: {
            select: { id: true, name: true, contact: true, channel: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // 3. Transform data per agent
      const agentStats = agents.map((agent) => {
        const agentConvs = conversations.filter(
          (c) => c.assignedToId === agent.id,
        );
        const current = agentConvs.filter((c) => c.status !== "RESOLVED");
        const resolved = agentConvs.filter((c) => c.status === "RESOLVED");

        return {
          agentId: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
          isActive: agent.isActive,
          isAvailable: agent.isAvailable,
          staffId: agent.staffId,
          totalAssignedCount: agentConvs.length,
          currentConvsCount: current.length,
          resolvedConvsCount: resolved.length,
          currentConversations: current.map((c) => ({
            id: c.id,
            status: c.status,
            updatedAt: c.updatedAt,
            lead: c.lead,
          })),
          resolvedConversations: resolved.map((c) => ({
            id: c.id,
            status: c.status,
            updatedAt: c.updatedAt,
            lead: c.lead,
          })),
        };
      });

      // Recent activity (live updates monitoring)
      const recentActivity = conversations.slice(0, 15).map((c) => ({
        conversationId: c.id,
        channel: c.channel,
        status: c.status,
        updatedAt: c.updatedAt,
        assignedTo: c.assignedTo
          ? { id: c.assignedTo.id, name: c.assignedTo.name }
          : null,
        leadName: c.lead?.name || "Unknown Lead",
        leadContact: c.lead?.contact || "",
      }));

      res.json({
        agentStats,
        recentActivity,
      });
    } catch (error: any) {
      console.error("Owner dashboard endpoint error:", error.message);
      res.status(500).json({ message: "Failed to load owner dashboard stats" });
    }
  },
);

/* ===============================
   GET CURRENT COMPANY
=============================== */
router.get("/my-company", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
      select: {
        id: true,
        name: true,
        companyCode: true,
      },
    });
    res.json(company);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch company details" });
  }
});

/* ===============================
   GET ALL STAFF
=============================== */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!["OWNER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const users = await prisma.user.findMany({
      where: {
        companyId: req.user.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roleDefinitionId: true,
        roleDefinition: {
          select: {
            name: true,
          }
        },
        isActive: true,
        isAvailable: true,
        staffId: true,
        residingAddress: true,
        phoneNumber: true,
        workspaceAuthScale: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* ===============================
   POST ONBOARD INVITE
=============================== */
const onboardInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  staffId: z.string().min(1, "Staff ID token is required").max(50),
  workspaceAuthScale: z.string().min(1, "Workspace Authorization Scale is required"),
  role: z.enum(["ADMIN", "AGENT"]).default("AGENT"),
  roleDefinitionId: z.string().nullable().optional(),
});

router.post("/onboard-invite", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!["OWNER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const parsed = onboardInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, staffId, workspaceAuthScale, role, roleDefinitionId } = parsed.data;

    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (existingEmail) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const existingStaffId = await prisma.user.findFirst({
      where: {
        staffId,
        companyId: req.user.companyId,
      },
    });

    if (existingStaffId) {
      return res.status(409).json({ message: "Staff ID token already taken or assigned in this company" });
    }

    // Auto-generate placeholder hash since password is required
    const randomPassword = require("crypto").randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        name: "Pending Onboarding", // Default dummy name
        email: email.toLowerCase(),
        passwordHash,
        role,
        roleDefinitionId: (roleDefinitionId === "" || !roleDefinitionId) ? null : roleDefinitionId,
        staffId,
        workspaceAuthScale,
        companyId: req.user.companyId,
        isActive: true, // Visible in list as pending signup
        isAvailable: false, // Not available for chats until complete
      },
    });

    // Log the audit event
    await prisma.systemAuditLog.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.userId,
        action: "TEAM_MEMBER_INVITED",
        metadata: {
          email,
          staffId,
          workspaceAuthScale,
          role,
        }
      }
    });

    res.status(201).json(newUser);
  } catch (err: any) {
    console.error("Onboard invite error:", err);
    res.status(500).json({ message: "Failed to create onboard invitation" });
  }
});

/* ===============================
   POST HEARTBEAT (Online Check)
=============================== */
router.post("/heartbeat", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Heartbeat failed for user ID:", req.user?.userId, "Error details:", err);
    res.status(500).json({ message: "Heartbeat failed", error: err?.message });
  }
});

/* ===============================
   CREATE STAFF (Auto Password)
=============================== */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!["OWNER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { name, email, role, staffId, password, roleDefinitionId } = parsed.data;

    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (existingEmail) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const existingStaffId = await prisma.user.findFirst({
      where: {
        staffId,
        companyId: req.user.companyId,
      },
    });

    if (existingStaffId) {
      return res.status(409).json({ message: "Staff ID already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        roleDefinitionId,
        staffId,
        companyId: req.user.companyId,
      },
    });

    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      staffId: newUser.staffId,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create user" });
  }
});

/* ===============================
   DISABLE USER
=============================== */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      if (req.user.role !== "OWNER") {
        return res
          .status(403)
          .json({ message: "Only owner can disable users" });
      }

      const { id } = req.params;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user || user.companyId !== req.user.companyId) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "OWNER") {
        return res
          .status(403)
          .json({ message: "Cannot disable the Owner account" });
      }

      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      res.json({ message: "User disabled successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to disable user" });
    }
  },
);

/* ===============================
   PATCH AVAILABILITY (Toggle isAvailable)
=============================== */
router.patch(
  "/:id/availability",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;
      const { isAvailable } = req.body;

      if (typeof isAvailable !== "boolean") {
        return res
          .status(400)
          .json({ message: "isAvailable must be a boolean" });
      }

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser || targetUser.companyId !== req.user.companyId) {
        return res.status(404).json({ message: "User not found" });
      }

      const isSelf = targetUser.id === req.user.userId;
      const isManager = ["OWNER", "ADMIN"].includes(req.user.role);

      if (!isSelf && !isManager) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isAvailable },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isAvailable: true,
          isActive: true,
          staffId: true,
          createdAt: true,
        },
      });

      res.json({
        message: "Availability updated successfully",
        user: updatedUser,
      });
    } catch (err) {
      console.error("Failed to update availability:", err);
      res.status(500).json({ message: "Failed to update availability" });
    }
  },
);

/* =========================================
   GET ACTIVE CHATS (Inbox History)
   ========================================= */
router.get(
  "/inbox/active",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;

      const clears = await prisma.agentChatHistoryClear.findMany({
        where: { userId, companyId },
      });
      const clearedAtMap = new Map<string, number>();
      for (const c of clears) {
        clearedAtMap.set(c.targetId, c.clearedAt.getTime());
      }

      const notes = await prisma.internalNote.findMany({
        where: {
          companyId,
        },
        select: {
          authorId: true,
          mentionedIds: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });

      const activeUserIds = new Set<string>();

      for (const note of notes) {
        let mentions: string[] = [];
        if (Array.isArray(note.mentionedIds)) {
          mentions = note.mentionedIds as string[];
        } else if (typeof note.mentionedIds === "string") {
          try {
            mentions = JSON.parse(note.mentionedIds);
          } catch {}
        } else if (note.mentionedIds && typeof note.mentionedIds === "object") {
          mentions = Object.values(note.mentionedIds).map(String);
        }

        if (note.authorId === userId) {
          mentions.forEach((id) => {
            const clearedAt = clearedAtMap.get(id) || 0;
            if (note.createdAt.getTime() > clearedAt) activeUserIds.add(id);
          });
        } else if (mentions.includes(userId)) {
          const clearedAt = clearedAtMap.get(note.authorId) || 0;
          if (note.createdAt.getTime() > clearedAt)
            activeUserIds.add(note.authorId);
        }
      }

      res.json(Array.from(activeUserIds));
    } catch (err) {
      console.error("Failed to fetch active chats:", err);
      res.status(500).json({ message: "Failed to fetch active chats" });
    }
  },
);

/* =========================================
   GET AGENT TO AGENT NOTES
   ========================================= */
router.get(
  "/:id/notes",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;
      const targetUserId = req.params.id;

      const clearRecord = await prisma.agentChatHistoryClear.findUnique({
        where: {
          userId_targetId: {
            userId,
            targetId: targetUserId,
          },
        },
      });

      const clearedAt = clearRecord?.clearedAt || new Date(0);

      const notes = await prisma.internalNote.findMany({
        where: {
          companyId,
          createdAt: { gt: clearedAt },
          OR: [{ authorId: targetUserId }, { authorId: userId }],
        },
        include: {
          conversation: {
            select: {
              id: true,
              assignedToId: true,
              lead: {
                select: {
                  name: true,
                  contact: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const filteredNotes = notes.filter((note) => {
        const mentionedArray = Array.isArray(note.mentionedIds)
          ? (note.mentionedIds as string[])
          : [];

        const isAuthorTarget = note.authorId === targetUserId;
        const isAuthorSelf = note.authorId === userId;

        const isSelfMentioned = mentionedArray.includes(userId);
        const isTargetMentioned = mentionedArray.includes(targetUserId);

        const isSelfAssigned = note.conversation?.assignedToId === userId;
        const isTargetAssigned =
          note.conversation?.assignedToId === targetUserId;

        if (isAuthorTarget) {
          return isSelfMentioned || isSelfAssigned || targetUserId === userId;
        }
        if (isAuthorSelf) {
          return isTargetMentioned || isTargetAssigned;
        }
        return false;
      });

      // Collect all user IDs from all reactions of filteredNotes
      const allUserIdsInReactions = new Set<string>();
      filteredNotes.forEach(note => {
        const noteReacts = inMemoryReactions.get(note.id) || {};
        Object.values(noteReacts).forEach(users => {
          users.forEach(uid => allUserIdsInReactions.add(uid));
        });
      });

      // Fetch user info for those IDs
      const reactionUsers = allUserIdsInReactions.size > 0 
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(allUserIdsInReactions) } },
            select: { id: true, name: true }
          })
        : [];

      const userMap = new Map(reactionUsers.map(u => [u.id, u.name]));

      const notesWithReactions = filteredNotes.map(note => {
        const noteReacts = inMemoryReactions.get(note.id) || {};
        const summarizedCount: Record<string, number> = {};
        const reactionsDetail: Record<string, Array<{ id: string; name: string }>> = {};

        for (const [em, users] of Object.entries(noteReacts)) {
          if (users.length > 0) {
            summarizedCount[em] = users.length;
            reactionsDetail[em] = users.map(uid => ({
              id: uid,
              name: userMap.get(uid) || "Teammate"
            }));
          }
        }
        return {
          ...note,
          reactions: summarizedCount,
          reactionsDetail: reactionsDetail
        };
      });

      res.json(notesWithReactions);
    } catch (error) {
      console.error("Fetch agent notes error:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  },
);

/* =========================================
   POST AGENT NOTE REACTION TOGGLE
   ========================================= */
router.post(
  "/:id/notes/:noteId/react",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { noteId } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ message: "Emoji is required" });
      }

      let noteReacts = inMemoryReactions.get(noteId) || {};
      let userList = noteReacts[emoji] || [];

      if (userList.includes(userId)) {
        userList = userList.filter((id) => id !== userId);
      } else {
        userList.push(userId);
      }

      noteReacts[emoji] = userList;
      inMemoryReactions.set(noteId, noteReacts);

      // Collect all unique user IDs involved in this note's reactions
      const noteUserIds = new Set<string>();
      Object.values(noteReacts).forEach(users => {
        users.forEach(uid => noteUserIds.add(uid));
      });

      const reactionUsersInfo = noteUserIds.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(noteUserIds) } },
            select: { id: true, name: true }
          })
        : [];
      
      const userMap = new Map(reactionUsersInfo.map(u => [u.id, u.name]));

      const summarizedCount: Record<string, number> = {};
      const reactionsDetail: Record<string, Array<{ id: string; name: string }>> = {};
      for (const [em, users] of Object.entries(noteReacts)) {
        if (users.length > 0) {
          summarizedCount[em] = users.length;
          reactionsDetail[em] = users.map(uid => ({
            id: uid,
            name: userMap.get(uid) || "Teammate"
          }));
        }
      }

      // Live realtime push to target agent
      const note = await prisma.internalNote.findUnique({
        where: { id: noteId },
        select: { authorId: true, mentionedIds: true, companyId: true }
      });

      if (note) {
        const mentions = Array.isArray(note.mentionedIds) ? (note.mentionedIds as string[]) : [];
        const affectedUsers = new Set<string>([note.authorId, ...mentions]);
        affectedUsers.forEach((targetId) => {
          emitToAgent(targetId, "agent_note_reaction_updated", {
            noteId,
            reactions: summarizedCount,
            reactionsDetail: reactionsDetail
          });
        });
      }

      res.json({ success: true, reactions: summarizedCount, reactionsDetail: reactionsDetail });
    } catch (err: any) {
      console.error("Toggle reaction error:", err);
      res.status(500).json({ message: "Failed to toggle reaction" });
    }
  }
);

router.delete(
  "/:id/notes",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;
      const targetUserId = req.params.id;
      const bothSides = req.query.bothSides === "true" || req.body?.bothSides;

      if (bothSides) {
        // Physical deletion for BOTH sides
        const notes = await prisma.internalNote.findMany({
          where: {
            companyId,
            OR: [{ authorId: targetUserId }, { authorId: userId }],
          },
          include: { conversation: true },
        });

        const noteIdsToDelete: string[] = [];

        for (const note of notes) {
          let mentions: string[] = [];
          
          if (Array.isArray(note.mentionedIds)) {
            mentions = note.mentionedIds as string[];
          } else if (typeof note.mentionedIds === "string") {
            try {
              mentions = JSON.parse(note.mentionedIds);
            } catch {}
          } else if (note.mentionedIds && typeof note.mentionedIds === "object") {
            mentions = Object.values(note.mentionedIds).map(String);
          }

          const isAuthorTarget = note.authorId === targetUserId;
          const isAuthorSelf = note.authorId === userId;
          const isSelfMentioned = mentions.includes(userId);
          const isTargetMentioned = mentions.includes(targetUserId);
          const isTargetAssigned = note.conversation?.assignedToId === targetUserId;
          const isSelfAssigned = note.conversation?.assignedToId === userId;

          const isTargetToSelf = isAuthorTarget && (isSelfMentioned || isSelfAssigned || targetUserId === userId);
          const isSelfToTarget = isAuthorSelf && (isTargetMentioned || isTargetAssigned);

          if (isTargetToSelf || isSelfToTarget) {
            noteIdsToDelete.push(note.id);
          }
        }

        if (noteIdsToDelete.length > 0) {
          await prisma.internalNote.deleteMany({
            where: {
              id: { in: noteIdsToDelete },
            },
          });
        }

        emitToAgent(targetUserId, "agent_chat_cleared", {
          by: userId,
        });

        res.json({ success: true, count: noteIdsToDelete.length });
      } else {
        // "Delete for Me" -> Only update the cleared timestamp (Virtual delete)
        const clearTime = new Date();
        await prisma.agentChatHistoryClear.upsert({
          where: {
            userId_targetId: { userId, targetId: targetUserId }
          },
          update: { clearedAt: clearTime },
          create: { userId, targetId: targetUserId, companyId, clearedAt: clearTime }
        });
        
        res.json({ success: true });
      }
    } catch (err: any) {
      console.error("Failed to clear chat history:", err);
      res.status(500).json({ message: "Failed to clear chat history", error: err.message });
    }
  },
);

/* =========================================
   POST AGENT TO AGENT NOTES (Direct Collaboration)
   ========================================= */
router.post(
  "/:id/notes",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;
      const targetUserId = req.params.id;
      const { content, conversationId } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }

      const author = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { name: true },
      });

      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      let conv;

      if (conversationId) {
        conv = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            companyId,
          },
        });
      }

      if (!conv) {
        // Fallback to the dedicated "Team Collaboration" internal conversation.
        // This prevents teammates' direct messages from accidentally associating with and polluting
        // real customer/lead conversations and triggering automatic notifications or tagging.
        let lead = await prisma.lead.findFirst({
          where: { contact: "INTERNAL_COLLAB", companyId },
        });

        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              name: "Team Collaboration",
              contact: "INTERNAL_COLLAB",
              channel: "WEBSITE",
              companyId,
              status: "CLAIMED",
            },
          });
        }

        conv = await prisma.conversation.findFirst({
          where: {
            leadId: lead.id,
            companyId,
          },
        });

        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              channel: "WEBSITE",
              leadId: lead.id,
              companyId,
              mode: "HUMAN",
              status: "OPEN",
            },
          });
        }
      }

      // Save the internal note
      const note = await prisma.internalNote.create({
        data: {
          conversationId: conv.id,
          companyId,
          authorId: userId,
          authorName: author?.name || "Agent",
          content: content.trim(),
          mentionedIds: [targetUserId],
        },
        include: {
          conversation: {
            select: {
              id: true,
              assignedToId: true,
              lead: {
                select: {
                  name: true,
                  contact: true,
                },
              },
            },
          },
        },
      });

      // Notify target agent
      const title = "New Team Note";
      const body = `${author?.name || "An agent"} sent you a note: "${content.trim().slice(0, 60)}..."`;
      await notificationService.notifyUser(
        targetUserId,
        title,
        body,
        "MESSAGE",
      );

      // Socket: direct inline update
      emitToAgent(targetUserId, "internal_note_mention", {
        noteId: note.id,
        conversationId: conv.id,
        authorName: author?.name || "Agent",
        preview: content.trim().slice(0, 80),
      });

      // Socket: live Agent Inbox dashboard push
      emitToAgent(targetUserId, "agent_inbox_new_note", {
        ...note,
        authorInitials: (author?.name || "Agent").charAt(0).toUpperCase(),
      });

      res.status(201).json({
        ...note,
        authorInitials: (author?.name || "Agent").charAt(0).toUpperCase(),
      });
    } catch (error) {
      console.error("Create agent note error:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  },
);

/* ===============================
   PUT /:id (Update User Details & Status)
=============================== */
router.put(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      if (!["OWNER", "ADMIN"].includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      const { name, email, staffId, role, isActive, roleDefinitionId, workspaceAuthScale } = req.body;

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser || targetUser.companyId !== req.user.companyId) {
        return res.status(404).json({ message: "User not found" });
      }

      // Security restrictions
      if (targetUser.role === "OWNER" && req.user.role !== "OWNER") {
        return res
          .status(403)
          .json({ message: "Only owners can modify the Owner account" });
      }

      // If user tries to change role TO owner or upgrade themselves/someone else to owner, restrict
      if (role === "OWNER" && req.user.role !== "OWNER") {
        return res
          .status(403)
          .json({ message: "Only current owners can assign the OWNER role" });
      }

      if (email && email.toLowerCase() !== targetUser.email.toLowerCase()) {
        const existingEmail = await prisma.user.findFirst({
          where: {
            email: email.toLowerCase(),
            companyId: req.user.companyId,
            id: { not: id },
          },
        });
        if (existingEmail) {
          return res.status(409).json({ message: "Email already taken inside company" });
        }
      }

      if (staffId && staffId !== targetUser.staffId) {
        const existingStaffId = await prisma.user.findFirst({
          where: {
            staffId,
            companyId: req.user.companyId,
            id: { not: id },
          },
        });
        if (existingStaffId) {
          return res.status(409).json({ message: "Staff ID already taken" });
        }
      }

      // Prevent OWNER from disabling their own account or changing their own role to AGENT/ADMIN
      if (targetUser.id === req.user.userId && targetUser.role === "OWNER") {
        if (role && role !== "OWNER") {
          return res.status(403).json({ message: "You cannot change your own OWNER role" });
        }
        if (isActive === false) {
          return res.status(403).json({ message: "You cannot deactivate your own OWNER account" });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          name: name ?? undefined,
          email: email ? email.toLowerCase() : undefined,
          staffId: staffId ?? undefined,
          role: role ?? undefined,
          roleDefinitionId: roleDefinitionId === '' ? null : (roleDefinitionId !== undefined ? roleDefinitionId : undefined),
          isActive: typeof isActive === "boolean" ? isActive : undefined,
          workspaceAuthScale: workspaceAuthScale ?? undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isAvailable: true,
          staffId: true,
          createdAt: true,
        },
      });

      res.json({
        message: "User details updated successfully",
        user: updatedUser,
      });
    } catch (err: any) {
      console.error("Failed to update user:", err);
      res.status(500).json({ message: "Failed to update user details" });
    }
  }
);

/* ===============================
   PATCH /:id/password (Change User Password)
=============================== */
router.patch(
  "/:id/password",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }

      const isSelf = id === req.user.userId;
      const isManager = ["OWNER", "ADMIN"].includes(req.user.role);

      if (!isSelf && !isManager) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser || targetUser.companyId !== req.user.companyId) {
        return res.status(404).json({ message: "User not found" });
      }

      if (targetUser.role === "OWNER" && req.user.role !== "OWNER") {
        return res
          .status(403)
          .json({ message: "Only owners can change the Owner password" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id },
        data: { passwordHash },
      });

      res.json({ message: "Password updated successfully" });
    } catch (err: any) {
      console.error("Failed to update user password:", err);
      res.status(500).json({ message: "Failed to update user password" });
    }
  }
);

export default router;
