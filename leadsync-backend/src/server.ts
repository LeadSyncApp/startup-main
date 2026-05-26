import "dotenv/config";
// Capture unhandled promise rejections early so the server doesn't crash silently
process.on("unhandledRejection", (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

import http from "http";
import app from "./app";
import { initSocket } from "./lib/socket";
import { startAutomationRunner } from "./services/automation.service";
import { startTelegramPolling } from "./services/telegram.polling";
import { prisma } from "./lib/prisma";

// If the infrastructure sets PORT=3000, we must run the backend on 4000 to prevent conflict with Vite
const PORT = process.env.PORT && parseInt(process.env.PORT, 10) !== 3000 ? process.env.PORT : 4000;

const server = http.createServer(app);
initSocket(server);

const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 [Shutdown] Received ${signal}. Starting graceful shutdown...`);
  
  // Close HTTP server first
  server.close(async () => {
    console.log("🌐 [Shutdown] HTTP server closed.");
    try {
      await prisma.$disconnect();
      console.log("🔌 [Shutdown] Prisma Client disconnected successfully.");
      process.exit(0);
    } catch (err) {
      console.error("❌ [Shutdown] Error during Prisma disconnection:", err);
      process.exit(1);
    }
  });

  // Force close after 10 seconds if graceful shutdown is hung
  setTimeout(() => {
    console.error("⚠️ [Shutdown] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

server.listen(PORT, () => {
  console.log(`🚀 LeadSync backend listening on port ${PORT}`);
  startAutomationRunner();
  startTelegramPolling().catch(err => {
    console.error("❌ Failed to start Telegram Polling on startup:", err);
  });
});
