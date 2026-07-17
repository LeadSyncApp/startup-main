import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";

const router = Router();

router.get("/me", authMiddleware as any, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
        isAvailable: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
            companyCode: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
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
    console.error("Auth /me error:", err);
    res.status(500).json({ message: "Failed to fetch user data" });
  }
});

export default router;