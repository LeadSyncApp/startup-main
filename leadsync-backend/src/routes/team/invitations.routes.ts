import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authMiddleware } from "../../middleware/auth.middleware";
import { can } from "../../services/auth/permissions.service";
import { notificationService } from "../../services/infrastructure/notification.service";
import { sendEmail, generateInviteEmailHtml } from "../../services";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { signToken } from "../../utils/jwt";

const router = Router();

/**
 * Generate a SHA-256 digest for fast DB lookups of invitation tokens.
 * bcrypt is used for the stored token (for security), but we also store
 * a SHA-256 hash as a lookup key so we can find the invitation in O(1).
 */
function computeTokenLookup(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/* =====================================================
   Create Invitation
   POST /api/team/invitations
   Requires: OWNER or MANAGER
===================================================== */

const createInviteSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(["MANAGER", "STAFF"]),
  message: z.string().max(500).optional(),
});

router.post("/", authMiddleware as any, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!userId || !companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!can(userRole, "team.invite")) {
      return res.status(403).json({ message: "You don't have permission to invite team members" });
    }

    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { email, role, message } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists and is active in this company
    // (pre-provisioned inactive users from expired/revoked invites don't count)
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail, companyId, isActive: true },
    });

    if (existingUser) {
      return res.status(409).json({ message: "This person is already a team member" });
    }

    // Check for pending invitation
    const pendingInvite = await prisma.invitation.findFirst({
      where: { email: normalizedEmail, companyId, status: "PENDING" },
    });

    if (pendingInvite) {
      return res.status(409).json({ message: "An invitation has already been sent to this email" });
    }

    // Generate secure token, lookup hash, and staffId
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const tokenLookup = computeTokenLookup(rawToken);
    const staffId = `LS-${companyId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get inviter name
    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, role: true },
    });

    const inviterName = inviter
      ? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim()
      : "A team member";

    // Create invitation + pre-provision user in transaction
    const invitation = await prisma.$transaction(async (tx) => {
      // Pre-provision the User record (inactive, no password yet)
      await tx.user.create({
        data: {
          email: normalizedEmail,
          role,
          companyId,
          staffId,
          isActive: false,   // Start inactive until they accept
          isAvailable: true,
          onboardingStatus: "PENDING",
        },
      });

      // Create invitation record
      return tx.invitation.create({
        data: {
          companyId,
          invitedByUserId: userId,
          email: normalizedEmail,
          role,
          token: tokenHash,
          tokenLookup,        // SHA-256 for fast O(1) lookup
          staffId,
          message,
          expiresAt,
        },
      });
    });

    // Build invite URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const inviteUrl = `${frontendUrl}/accept-invite?token=${rawToken}`;

    // Get company name for the email
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    // Send invitation email to the invited person
    const companyName = company?.name || "the company";
    const emailHtml = generateInviteEmailHtml(inviterName, companyName, inviteUrl, role, staffId, message || null);
    await sendEmail({
      to: normalizedEmail,
      subject: `${inviterName} has invited you to join ${companyName} on LeadSync CRM`,
      html: emailHtml,
      replyTo: process.env.SMTP_FROM,
      text: `You've been invited to join ${companyName} on LeadSync CRM as a ${role.toLowerCase()}. Click here to accept: ${inviteUrl}`,
    }).catch((err) => {
      console.error("Failed to send invitation email, but invitation was created:", err);
    });

    // Notify company admins
    await notificationService.notifyCompanyAdmins(
      companyId,
      `New Invitation Sent`,
      `${inviterName} invited ${normalizedEmail} as ${role.toLowerCase()}`,
      "SYSTEM"
    );

    res.status(201).json({
      message: `Invitation sent to ${normalizedEmail}`,
      invitation: {
        id: invitation.id,
        email: normalizedEmail,
        role,
        staffId,
        status: "PENDING",
        inviteUrl,
        expiresAt,
      },
    });
  } catch (error: any) {
    console.error("Create invitation error:", error);
    res.status(500).json({ message: "Failed to create invitation" });
  }
});

/* =====================================================
   Validate Invitation Token
   POST /api/team/invitations/validate
   Uses O(1) SHA-256 tokenLookup for fast retrieval
===================================================== */

router.post("/validate", async (req: any, res: any) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const tokenLookup = computeTokenLookup(token);

    // O(1) lookup using the SHA-256 digest
    const invitation = await prisma.invitation.findFirst({
      where: {
        tokenLookup,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        company: {
          select: { id: true, name: true, companyCode: true },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    // Verify the token matches the bcrypt hash (extra security check)
    const isValid = await bcrypt.compare(token, invitation.token);
    if (!isValid) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    res.json({
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        staffId: invitation.staffId,
        company: {
          id: invitation.company.id,
          name: invitation.company.name,
          companyCode: invitation.company.companyCode,
        },
      },
    });
  } catch (error: any) {
    console.error("Validate invitation error:", error);
    res.status(500).json({ message: "Failed to validate invitation" });
  }
});

/* =====================================================
   Accept Invitation (Complete Onboarding)
   POST /api/team/invitations/accept
   Uses O(1) SHA-256 tokenLookup for fast retrieval
===================================================== */

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  residingAddress: z.string().min(1, "Address is required"),
});

router.post("/accept", async (req: any, res: any) => {
  try {
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { token, firstName, lastName, password, phoneNumber, residingAddress } = parsed.data;
    const tokenLookup = computeTokenLookup(token);

    // O(1) lookup using the SHA-256 digest
    const invitation = await prisma.invitation.findFirst({
      where: {
        tokenLookup,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: { company: true },
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    // Verify the token matches the bcrypt hash (extra security check)
    const isValid = await bcrypt.compare(token, invitation.token);
    if (!isValid) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Update user and invitation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find the pre-provisioned user
      const user = await tx.user.findFirst({
        where: { email: invitation.email, companyId: invitation.companyId },
      });

      if (!user) {
        throw new Error("User record not found. Please contact your team admin.");
      }

      // Update user details (now becomes active since they set a password)
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          firstName,
          lastName,
          passwordHash,
          phoneNumber,
          residingAddress,
          isActive: true,
          isOnline: true,
          lastSeenAt: new Date(),
          onboardingStatus: "ONBOARDED",
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      return { user: updatedUser, company: invitation.company };
    });

    // Sign JWT token (static import at top)
    const jwtToken = signToken({
      userId: result.user.id,
      companyId: result.company.id,
      role: result.user.role,
    });

    // Notify company admins
    const fullName = `${firstName} ${lastName || ""}`.trim();
    await notificationService.notifyCompanyAdmins(
      result.company.id,
      "🎉 New Team Member Onboarded",
      `${fullName} has joined as ${invitation.role.toLowerCase()}!`,
      "SYSTEM"
    );

    res.status(200).json({
      message: "Welcome to the team! You've been onboarded successfully.",
      token: jwtToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName,
        lastName,
        name: fullName,
        role: result.user.role,
        companyId: result.user.companyId,
        isAvailable: result.user.isAvailable,
        staffId: result.user.staffId,
      },
      company: {
        id: result.company.id,
        name: result.company.name,
        companyCode: result.company.companyCode,
      },
    });
  } catch (error: any) {
    console.error("Accept invitation error:", error);
    res.status(500).json({ message: error.message || "Failed to accept invitation" });
  }
});

/* =====================================================
   Revoke Invitation
   POST /api/team/invitations/:id/revoke
===================================================== */

router.post("/:id/revoke", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const companyId = req.user?.companyId;

    if (!can(userRole, "team.invite.revoke")) {
      return res.status(403).json({ message: "You don't have permission to revoke invitations" });
    }

    const invitation = await prisma.invitation.findFirst({
      where: { id, companyId },
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    // Also soft-deactivate the pre-provisioned user
    await prisma.user.updateMany({
      where: { email: invitation.email, companyId },
      data: { isActive: false },
    });

    res.json({ message: "Invitation revoked successfully" });
  } catch (error: any) {
    console.error("Revoke invitation error:", error);
    res.status(500).json({ message: "Failed to revoke invitation" });
  }
});

/* =====================================================
   List Invitations for Company
   GET /api/team/invitations
===================================================== */

router.get("/", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!can(userRole, "team.view")) {
      return res.status(403).json({ message: "You don't have permission to view invitations" });
    }

    const invitations = await prisma.invitation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        staffId: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json({ invitations });
  } catch (error: any) {
    console.error("List invitations error:", error);
    res.status(500).json({ message: "Failed to list invitations" });
  }
});

export default router;