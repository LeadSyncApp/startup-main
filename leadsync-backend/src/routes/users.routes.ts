import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

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

    const { name, email, role, staffId, password } = req.body;

    if (!name || !email || !role || !staffId || !password) {
      return res.status(400).json({ message: "Missing fields. Name, email, role, staffId, and password are required." });
    }

    if (!["ADMIN", "AGENT"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

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
