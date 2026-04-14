import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  staffId: z.string().min(1, "Staff ID is required").max(50),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.enum(["ADMIN", "AGENT"], { error: "Role must be ADMIN or AGENT" }),
});

const router = Router();

/* ===============================
   GET COMPACT LIST (all roles)
   Returns id + name for @mention / assignment UI
=============================== */
router.get("/list", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const users = await prisma.user.findMany({
      where: { companyId: req.user.companyId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch {
    res.status(500).json({ message: "Failed to fetch user list" });
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
        isActive: true,
        staffId: true,
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
    const { name, email, role, staffId, password } = parsed.data;

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
router.delete("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (req.user.role !== "OWNER") {
      return res.status(403).json({ message: "Only owner can disable users" });
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user || user.companyId !== req.user.companyId) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "OWNER") {
      return res.status(403).json({ message: "Cannot disable the Owner account" });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: "User disabled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to disable user" });
  }
});

export default router;
