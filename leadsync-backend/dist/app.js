"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const leads_routes_1 = __importDefault(require("./routes/leads/leads.routes"));
const telegram_routes_1 = __importDefault(require("./routes/telegram/telegram.routes"));
const integrations_routes_1 = __importDefault(require("./routes/integrations.routes"));
const secure_routes_1 = __importDefault(require("./routes/secure.routes"));
const conversations_routes_1 = __importDefault(require("./routes/conversations.routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const telegram_integration_routes_1 = __importDefault(require("./routes/telegram.integration.routes"));
const instagram_integration_routes_1 = __importDefault(require("./routes/instagram.integration.routes"));
const orders_routes_1 = __importDefault(require("./routes/orders.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
console.log("🔥 app.ts loaded");
const app = (0, express_1.default)();
app.use((0, compression_1.default)()); // ✅ GZIP Compression
app.use((0, cors_1.default)({
    origin: "*", // 🌍 Allow ANY device/origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.json({ status: "LeadSync backend running 🚀" });
});
/* 🔓 PUBLIC ROUTES */
app.use("/api/auth", auth_routes_1.default);
app.use("/api/telegram", telegram_routes_1.default);
app.use("/api/public", public_routes_1.default);
app.use("/api/integrations", integrations_routes_1.default);
app.use("/api/integrations", telegram_integration_routes_1.default);
app.use("/api/integrations", instagram_integration_routes_1.default);
/* 🔐 SECURE ROUTE */
app.use("/api/secure", secure_routes_1.default);
/* 🔐 MAIN ROUTES */
app.use("/api/leads", leads_routes_1.default);
app.use("/api/conversations", conversations_routes_1.default);
app.use("/api/dashboard", dashboard_routes_1.default);
app.use("/api/orders", orders_routes_1.default);
app.use("/api/users", users_routes_1.default);
app.use("/api/analytics", analytics_routes_1.default);
app.use("/api/notifications", notification_routes_1.default);
/* 🩺 DIAGNOSTIC ROUTE */
app.get("/api/debug/system", async (req, res) => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: {
            has_gemini_key: !!process.env.GEMINI_API_KEY,
            gemini_key_prefix: process.env.GEMINI_API_KEY?.substring(0, 7),
            has_groq_key: !!process.env.GROQ_API_KEY,
            groq_key_prefix: process.env.GROQ_API_KEY?.substring(0, 7),
            has_openrouter_key: !!process.env.OPENROUTER_API_KEY,
            openrouter_key_prefix: process.env.OPENROUTER_API_KEY?.substring(0, 7),
        }
    };
    res.json(diagnostics);
});
exports.default = app;
