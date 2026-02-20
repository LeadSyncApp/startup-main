import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

/* ===============================
   CONNECT INSTAGRAM
=============================== */
router.post(
    "/instagram/connect",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const { pageId, accessToken } = req.body;

            if (!pageId || !accessToken) {
                return res.status(400).json({ message: "Page ID and Access Token are required" });
            }

            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            /* Save instagram details in DB */
            await prisma.company.update({
                where: { id: req.user.companyId },
                data: {
                    instagramPageId: pageId,
                    instagramPageAccessToken: accessToken,
                    instagramConnected: true,
                },
            });

            return res.json({
                message: "Instagram connected successfully",
                pageId,
            });
        } catch (error: any) {
            console.error("Instagram connect error:", error);
            return res.status(500).json({
                message: "Failed to connect Instagram",
            });
        }
    }
);

/* ===============================
   DISCONNECT INSTAGRAM
=============================== */
router.post(
    "/instagram/disconnect",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            await prisma.company.update({
                where: { id: req.user.companyId },
                data: {
                    instagramPageId: null,
                    instagramPageAccessToken: null,
                    instagramConnected: false,
                },
            });

            return res.json({ message: "Instagram disconnected successfully" });
        } catch (error: any) {
            console.error("Instagram disconnect error:", error);
            return res.status(500).json({
                message: "Failed to disconnect Instagram",
            });
        }
    }
);

export default router;
