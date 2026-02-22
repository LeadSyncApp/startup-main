"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/* ===============================
   CONNECT INSTAGRAM
=============================== */
router.post("/instagram/connect", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { pageId, accessToken } = req.body;
        if (!pageId || !accessToken) {
            return res.status(400).json({ message: "Page ID and Access Token are required" });
        }
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        /* Save instagram details in DB */
        await prisma_1.prisma.company.update({
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
    }
    catch (error) {
        console.error("Instagram connect error:", error);
        return res.status(500).json({
            message: "Failed to connect Instagram",
        });
    }
});
/* ===============================
   DISCONNECT INSTAGRAM
=============================== */
router.post("/instagram/disconnect", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        await prisma_1.prisma.company.update({
            where: { id: req.user.companyId },
            data: {
                instagramPageId: null,
                instagramPageAccessToken: null,
                instagramConnected: false,
            },
        });
        return res.json({ message: "Instagram disconnected successfully" });
    }
    catch (error) {
        console.error("Instagram disconnect error:", error);
        return res.status(500).json({
            message: "Failed to disconnect Instagram",
        });
    }
});
exports.default = router;
