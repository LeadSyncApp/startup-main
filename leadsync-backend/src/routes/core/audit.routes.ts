import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== "OWNER") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const logs = await prisma.systemAuditLog.findMany({
      where: { companyId: req.user.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export const auditLogRoutes = router;
