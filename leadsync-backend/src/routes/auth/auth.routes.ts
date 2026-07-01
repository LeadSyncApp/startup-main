import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../utils/jwt";
import crypto from "crypto";
import { generatePasswordResetHtml } from "../../services/integrations/email.service";
import { queueProvider } from "../../services/infrastructure/queue-provider/queue-provider.factory";
import { notificationService } from "../../services/infrastructure/notification.service";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

console.log("🔥 auth.routes.ts loaded");

const signupSchema = z.object({
  companyName: z.string().max(100).optional(),
  firstName: z.string().min(1, "First Name is required").max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  phone: z.string().min(10, "Phone number is required").max(20).optional(),
  currencyCode: z.string().max(10).optional(),
  currencySymbol: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
});

const loginSchema = z.object({
  role: z.enum(["OWNER", "MANAGER", "STAFF"]).optional(),
  companyCode: z.string().optional(),
  staffId: z.string().optional(),
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(100),
});

/* =====================================================
   SIGNUP (OWNER)
===================================================== */
router.post("/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { companyName, firstName, lastName, email, password, phone, currencyCode, currencySymbol, timezone } = parsed.data;

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Auto-generate company code
    const rawName = companyName || `${firstName}${lastName ? ' ' + lastName : ''} Co`;
    const sanitizedName = rawName.replace(/[^a-zA-Z]/g, "").substring(0, 8).toUpperCase() || "COMP";
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4 digits
    const companyCode = `${sanitizedName}${randomSuffix}`;

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName || `${firstName}'s Company`,
          companyCode,
          currencyCode: currencyCode?.toUpperCase() || "INR",
          currencySymbol: currencySymbol || "₹",
          timezone: timezone || "Asia/Kolkata",
          users: {
            create: {
              firstName,
              lastName,
              email: normalizedEmail,
              role: "OWNER",
              passwordHash,
              phoneNumber: phone,
            },
          },
        },
        select: {
          id: true,
          name: true,
          companyCode: true,
          users: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isAvailable: true,
            },
          },
        },
      });

      await tx.botConfiguration.create({
        data: {
          companyId: company.id,
          botPolicies: "NOT_CONFIGURED",
          botCommands: []
        }
      });

      await tx.automationRule.create({
        data: {
          companyId: company.id,
          name: "Default Greeting Rule",
          isActive: false,
          trigger: "NEW_CONVERSATION",
          action: "SEND_MESSAGE",
          actionPayload: { text: "Hello! How can we help?" }
        }
      });

      await tx.customFieldDefinition.create({
        data: {
          companyId: company.id,
          module: "LEAD",
          name: "source",
          label: "Source",
          type: "TEXT",
        }
      });

      return company;
    });

    const owner = result.users[0];
    const company = result;

    const token = signToken({
      userId: owner.id,
      companyId: company.id,
      role: owner.role,
    });

    res.status(201).json({
      token,
      user: {
        id: owner.id,
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName,
        name: `${owner.firstName} ${owner.lastName || ""}`.trim(),
        role: owner.role,
        companyId: company.id,
        isAvailable: owner.isAvailable,
      },
      company: {
        id: company.id,
        name: company.name,
        companyCode: company.companyCode,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Signup failed", error: err instanceof Error ? err.message : String(err) });
  }
});

/* =====================================================
   LOGIN
===================================================== */
router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, password, staffId, companyCode, role } = parsed.data;

    const identifier = email.toLowerCase().trim();
    const providedStaffId = staffId ? staffId.trim() : "";
    const providedCompanyCode = companyCode ? companyCode.trim().toUpperCase() : "";

    // Build query based on role
    const userQuery: any = {
      email: identifier,
      isActive: true, // 🔐 block disabled users
    };

    const user = await prisma.user.findFirst({
      where: userQuery,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
        isAvailable: true,
        passwordHash: true,
        companyId: true,
        company: true,
        authProvider: true,
        googleId: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Role enforcement - only if explicitly requested
    if (role && user.role !== role) {
      if (user.role === "OWNER" && role !== "OWNER") {
        return res.status(401).json({ message: "Please select the authentic 'Owner' role to login" });
      }
      if (user.role !== "OWNER" && role === "OWNER") {
        return res.status(401).json({ message: "Invalid credentials. You are not an Owner." });
      }
    }

    const valid = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!valid) {
      const provider = user.authProvider || (user.googleId ? "GOOGLE" : "EMAIL");
      if (provider === "GOOGLE" || provider === "BOTH") {
        return res.status(401).json({ message: "You signed up with Google. Please use Google sign-in." });
      }
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Unified Login logic: If only email/password provided, allow entry if credentials match
    // If specific identifiers provided, enforce them for security
    
    if (role !== "OWNER") {
      if (providedStaffId && user.staffId !== providedStaffId) {
        return res.status(401).json({ message: "Invalid Staff ID" });
      }
    } else {
      // Role is OWNER
      if (providedCompanyCode && user.company.companyCode !== providedCompanyCode) {
        return res.status(401).json({ message: "Invalid Company ID / Code" });
      }
    }

    // Update online status on login
    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });

    const token = signToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      authProvider: user.authProvider || (user.googleId ? "GOOGLE" : "EMAIL"),
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName || ""}`.trim(),
        role: user.role,
        companyId: user.companyId,
        isAvailable: user.isAvailable,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        companyCode: user.company.companyCode,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

/* =====================================================
   FORGOT PASSWORD
===================================================== */
router.post("/forgot-password", async (req, res) => {
  try {
    console.log('🔐 Forgot password request received');
    
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log('❌ Forgot password - Validation failed:', parsed.error.issues[0].message);
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email } = parsed.data;

    const normalizedEmail = email.toLowerCase().trim();
    console.log('📧 Forgot password - Looking up user:', normalizedEmail);

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.log('⚠️ Forgot password - User not found, returning success for security');
      // Don't reveal if email exists for security
      return res.status(200).json({ 
        message: "If an account with this email exists, a password reset link has been sent."
      });
    }

    const userName = `${user.firstName} ${user.lastName || ""}`.trim();
    console.log('✅ Forgot password - User found:', { userId: user.id, userName });

    // Generate secure reset token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    console.log('🔑 Forgot password - Generated raw reset token, expiry:', resetTokenExpiry);

    // Hash the reset token before storing
    const hashedResetToken = await bcrypt.hash(rawResetToken, 10);
    console.log('🔒 Forgot password - Hashed reset token for storage');

    // Store hashed reset token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedResetToken,
        resetTokenExpiry,
      },
    });

    console.log('💾 Forgot password - Reset token stored in database');

    // Build reset URL using frontend URL from environment
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawResetToken}`;
    
    console.log('🔗 Forgot password - Generated reset URL:', resetUrl);
    console.log('🌐 Forgot password - Frontend URL from env:', frontendUrl);

    try {
      const userName = `${user.firstName} ${user.lastName || ""}`.trim();
      // Send password reset email
      const emailHtml = generatePasswordResetHtml(resetUrl, userName);
      await queueProvider.enqueue("sendEmail", {
        to: user.email,
        subject: 'Reset your LeadSync CRM password',
        html: emailHtml,
        text: `Hello ${userName},\n\nPlease click the following link to reset your password: ${resetUrl}\n\nThis link will expire in 10 minutes.\n\nIf you didn't request this password reset, you can safely ignore this email.\n\nLeadSync CRM`,
      });

      console.log('📤 Forgot password - Email sent successfully to:', user.email);

      res.status(200).json({ 
        message: "Password reset link has been sent to your email"
      });
    } catch (emailError) {
      console.error('❌ Forgot password - Email send failed:', emailError);
      
      // Check if this is a provider restriction error
      if (emailError instanceof Error && (emailError as any).code === 'PROVIDER_RESTRICTION') {
        return res.status(422).json({ 
          message: "Password reset email is currently limited to verified test recipients until the sender domain is verified." 
        });
      }
      
      // Clear the reset token since email failed
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      return res.status(500).json({ 
        message: "Failed to send password reset email. Please try again later." 
      });
    }
  } catch (err) {
    console.error('❌ Forgot password - Unexpected error:', err);
    res.status(500).json({ message: "Failed to process forgot password request" });
  }
});

/* =====================================================
   RESET PASSWORD
===================================================== */
router.post("/reset-password", async (req, res) => {
  try {
    console.log('🔐 Reset password request received');
    
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log('❌ Reset password - Validation failed:', parsed.error.issues[0].message);
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { token, newPassword } = parsed.data;

    console.log('🔑 Reset password - Looking up user with valid reset token');

    // Find all users with reset tokens (we need to check the hash)
    const usersWithResetTokens = await prisma.user.findMany({
      where: {
        resetToken: {
          not: null,
        },
        resetTokenExpiry: {
          gt: new Date(), // Token not expired
        },
      },
    });

    console.log('🔍 Reset password - Found users with reset tokens:', usersWithResetTokens.length);

    // Find the user whose hashed token matches the provided token
    let validUser = null;
    for (const user of usersWithResetTokens) {
      if (user.resetToken) {
        const isValid = await bcrypt.compare(token, user.resetToken);
        if (isValid) {
          validUser = user;
          break;
        }
      }
    }

    if (!validUser) {
      console.log('❌ Reset password - Invalid or expired reset token');
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const userName = `${validUser.firstName} ${validUser.lastName || ""}`.trim();
    console.log('✅ Reset password - Valid token found for user:', { userId: validUser.id, userName });

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log('🔒 Reset password - New password hashed');

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: validUser.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    console.log('💾 Reset password - Password updated and reset token cleared for user:', validUser.id);

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error('❌ Reset password - Unexpected error:', err);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

/* =====================================================
   STAFF SIGNUP (Onboard completion)
===================================================== */
const staffSignupSchema = z.object({
  companyCode: z.string().min(1, "Company Access Code is required"),
  staffId: z.string().min(1, "Staff ID token is required"),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  residingAddress: z.string().min(1, "Residing Address is required"),
  phoneNumber: z.string().min(1, "Phone Number is required"),
});

router.post("/staff-signup", async (req, res) => {
  try {
    const parsed = staffSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { companyCode, staffId, firstName, lastName, password, residingAddress, phoneNumber } = parsed.data;

    const company = await prisma.company.findFirst({
      where: {
        companyCode: {
          equals: companyCode.trim().toUpperCase(),
          mode: "insensitive",// Case-insensitive comparison
        }
      }
    });

    if (!company) {
      return res.status(404).json({ message: "Invalid Company Access Code" });
    }

    const user = await prisma.user.findFirst({
      where: {
        companyId: company.id,
        staffId: {
          equals: staffId.trim(),
          mode: "insensitive",
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: "Invalid Staff ID Token for this company" });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Complete the onboarding / update details
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        passwordHash,
        residingAddress,
        phoneNumber,
        isActive: true,
        // Do NOT set isOnline:true here — the socket connection + heartbeat
        // will set online status once the user actually connects
        isOnline: false,
        lastSeenAt: new Date(),
      }
    });

    const fullName = `${updatedUser.firstName} ${updatedUser.lastName || ""}`.trim();

    // Notify the Owner and Admins
    await notificationService.notifyCompanyAdmins(
      company.id,
      "🎉 Teammate Onboarded",
      `${fullName} has completed onboarding & registered successfully with staff ID: ${staffId}`,
      "SYSTEM"
    );

    // Sign complete token
    const token = signToken({
      userId: user.id,
      companyId: company.id,
      role: user.role,
    });

    res.status(200).json({
      message: "Onboarding details saved successfully!",
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        name: fullName,
        role: updatedUser.role,
        companyId: updatedUser.companyId,
        isAvailable: updatedUser.isAvailable,
      },
      company: {
        id: company.id,
        name: company.name,
        companyCode: company.companyCode,
      }
    });

  } catch (error: any) {
    console.error("Staff onboarding signup failed:", error);
    res.status(500).json({ message: "Failed to complete onboarding signup" });
  }
});

/* =====================================================
   COMPLETE GOOGLE ONBOARDING (wizard steps 2 & 3)
   Called when a Google signup user finishes the wizard
   Requires auth token (from the initial Google OAuth)
===================================================== */

const completeGoogleOnboardingSchema = z.object({
  businessScale: z.enum(["HOME", "SME"]),
  businessType: z.string().min(1, "Business type is required"),
  currentWorkflow: z.enum(["PAPER", "SPREADSHEET", "CRM"]),
  companyName: z.string().min(1, "Company name is required"),
});

router.put("/complete-google-onboarding", authMiddleware as any, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parsed = completeGoogleOnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { businessScale, businessType, currentWorkflow, companyName } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Map businessScale to the database enum
    const dbScale = businessScale === "HOME" ? "HOME_GROWN" : "SME_RETAIL";

    // Update company with wizard data
    const updatedCompany = await prisma.company.update({
      where: { id: user.companyId },
      data: {
        name: companyName,
        scale: dbScale as any,
        botBusinessType: businessType,
      },
    });

    res.json({
      message: "Onboarding completed successfully",
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        companyCode: updatedCompany.companyCode,
        scale: updatedCompany.scale,
        botBusinessType: updatedCompany.botBusinessType,
      },
    });
  } catch (err) {
    console.error("Complete Google onboarding error:", err);
    res.status(500).json({ message: "Failed to complete onboarding" });
  }
});

export default router;
