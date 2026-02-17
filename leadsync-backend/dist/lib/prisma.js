"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("FATAL: DATABASE_URL is not defined.");
    process.exit(1);
}
const createPrismaClient = () => new client_1.PrismaClient({
    log: process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
});
exports.prisma = global.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production") {
    global.prisma = exports.prisma;
}
