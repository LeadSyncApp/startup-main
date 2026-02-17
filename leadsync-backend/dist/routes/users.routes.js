"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/* ===============================
   GET ALL STAFF
=============================== */
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        if (!["OWNER", "ADMIN"].includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const users = await prisma_1.prisma.user.findMany({
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
    }
    catch (err) {
        res.status(500).json({ message: "Failed to fetch users" });
    }
});
/* ===============================
   CREATE STAFF (Auto Password)
=============================== */
router.post("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
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
        const existingEmail = await prisma_1.prisma.user.findFirst({
            where: {
                email: email.toLowerCase(),
            },
        });
        if (existingEmail) {
            return res.status(409).json({ message: "Email already exists" });
        }
        const existingStaffId = await prisma_1.prisma.user.findFirst({
            where: {
                staffId,
                companyId: req.user.companyId,
            },
        });
        if (existingStaffId) {
            return res.status(409).json({ message: "Staff ID already taken" });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const newUser = await prisma_1.prisma.user.create({
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
    }
    catch (err) {
        res.status(500).json({ message: "Failed to create user" });
    }
});
/* ===============================
   DISABLE USER
=============================== */
router.delete("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        if (req.user.role !== "OWNER") {
            return res.status(403).json({ message: "Only owner can disable users" });
        }
        const { id } = req.params;
        const user = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!user || user.companyId !== req.user.companyId) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.role === "OWNER") {
            return res.status(403).json({ message: "Cannot disable the Owner account" });
        }
        await prisma_1.prisma.user.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({ message: "User disabled successfully" });
    }
    catch (err) {
        res.status(500).json({ message: "Failed to disable user" });
    }
});
exports.default = router;
