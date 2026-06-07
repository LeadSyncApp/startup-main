import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";
import { z } from "zod";

const router = Router();

const roleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

// Get all roles
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== "OWNER") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roles = await prisma.roleDefinition.findMany({
      where: { companyId: req.user.companyId },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create role
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== "OWNER") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const role = await prisma.roleDefinition.create({
      data: {
        ...parsed.data,
        companyId: req.user.companyId,
      },
    });

    await prisma.systemAuditLog.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.userId,
        action: "CUSTOM_ROLE_CREATED",
        metadata: { roleName: role.name },
      }
    });

    res.status(201).json(role);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: "Role with this name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
});

// Assign role to user
router.patch("/assign", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== "OWNER") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, roleDefinitionId } = req.body;
    
    // verify user belongs to company
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId: req.user.companyId }
    });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { roleDefinitionId },
    });

    await prisma.systemAuditLog.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.userId,
        action: "ROLE_ASSIGNED",
        metadata: { targetUserId: userId, roleDefinitionId },
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export const rbacRoutes = router;
