import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

/* ===============================
   GET ALL STAFF (Owner/Admin)
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
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* ===============================
   CREATE STAFF
=============================== */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!["OWNER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!["ADMIN", "AGENT"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        companyId: req.user.companyId,
      },
    });

    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        companyId: req.user.companyId,
      },
    });

    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

/* ===============================
   UPDATE USER
=============================== */
router.patch("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!["OWNER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { id } = req.params;
    const { role, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user || user.companyId !== req.user.companyId) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateData: any = {};

    if (role && ["ADMIN", "AGENT"].includes(role)) {
      updateData.role = role;
    }

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update user" });
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

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: "User disabled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to disable user" });
  }
});

export default router;
