import "dotenv/config";
import crypto from "crypto";
import http from "http";
import app from "./app";
import { initSocket } from "./lib/socket";
import { startTelegramPolling } from "./services/messaging/telegram.polling";
import { initializeTelegramWebhooks } from "./services/messaging/telegram.webhook";
import { prisma } from "./lib/prisma";
import { taskTracker } from "./services/infrastructure/taskTracker";
import { pgBossService } from "./services/infrastructure/pgboss/pgboss.service";
import { WorkerRegistry } from "./services/infrastructure/pgboss/worker.registry";
import { SchedulerRegistry } from "./services/infrastructure/pgboss/scheduler.registry";
import { sysLog } from "./lib/logger";
import { startOrchestratorWorker } from "./services/workers/ai.orchestrator.worker";
import { startAiTriageWorker } from "./services/workers/ai.triage.worker";
import { ensureRerankerReady } from "./services/knowledge/productMatch.service";
import { reapGhostsForCompany } from "./services/infrastructure/ghostReaper.service";

const PROCESS_PROFILE = process.env.PROCESS_PROFILE || "COMBINED";
const PORT = 4000;

// Validate essential configuration before proceeding with initialization
const key = process.env.ENCRYPTION_KEY;
if (!key || key.length < 32) {
  sysLog.error("FATAL: ENCRYPTION_KEY must be defined and at least 32 characters long");
  process.exit(1);
}

// Log unhandled promise rejections as structured structured error logs
process.on("unhandledRejection", (reason, promise) => {
  sysLog.error("Unhandled Rejection detected", reason);
});

const server = http.createServer(app);

// Initialize WebSockets only in WEB or COMBINED mode
if (PROCESS_PROFILE === "WEB" || PROCESS_PROFILE === "COMBINED") {
  initSocket(server);
}

/**
 * Handles graceful process termination. Safely drains active jobs, disconnects
 * database clients, stops background listeners, and releases OS resources.
 */
const gracefulShutdown = async (signal: string) => {
  sysLog.info(`🛑 [Shutdown] Received ${signal}. Starting graceful shutdown sequence...`);

  const shutdownSequence = async () => {
    sysLog.info("🌐 [Shutdown] Safely draining resources...");
    try {
      // 1. Drain active tracked tasks (such as active webhook operations)
      sysLog.info("⏳ [Shutdown] Phase 1/3: Waiting for active tracked tasks to finish...");
      await taskTracker.waitForCompletion(15000);

      // 2. Shut down PgBoss Queue Client & Workers
      sysLog.info("⏳ [Shutdown] Phase 2/3: Stopping PgBoss service and queue listeners...");
      await pgBossService.stop();

      // 3. Close the Prisma client pool
      sysLog.info("⏳ [Shutdown] Phase 3/3: Disconnecting Prisma database connections...");
      await prisma.$disconnect();

      sysLog.info("🔌 [Shutdown] Resource cleanup completed successfully. Process exiting.");
      process.exit(0);
    } catch (err: any) {
      sysLog.error("❌ [Shutdown] Fatal error encountered during graceful shutdown", err);
      process.exit(1);
    }
  };

  if ((PROCESS_PROFILE === "WEB" || PROCESS_PROFILE === "COMBINED") && server.listening) {
    server.close(async () => {
      sysLog.info("📡 [Shutdown] Incoming web connections closed.");
      await shutdownSequence();
    });
  } else {
    await shutdownSequence();
  }

  // Fallback safety timeout to prevent complete process hangs on stuck tasks
  setTimeout(() => {
    sysLog.warn("⚠️ [Shutdown] Graceful shutdown limit exceeded. Enforcing immediate forced exit.");
    process.exit(1);
  }, 20000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function bootstrap() {
  try {
    sysLog.info(`🚀 [Bootstrap] Starting application instance with profile: ${PROCESS_PROFILE}`);

    // Ensure database connection pool is established
    await prisma.$connect();
    sysLog.info("🔌 [Bootstrap] Database connectivity successfully verified.");

    // One-time startup ghost cleanup for any pre-existing orphan conversations
    try {
      const companies = await prisma.company.findMany({
        select: { id: true },
      });
      for (const company of companies) {
        await reapGhostsForCompany(company.id);
      }
      sysLog.info("[ghost-reaper] Startup cleanup complete");
    } catch (err: any) {
      sysLog.error("[ghost-reaper] Startup cleanup failed:", err);
    }

    // Initialize the PgBoss service client (always required so database schema is synchronized or jobs can be queued)
    await pgBossService.initialize();
    sysLog.info("📦 [Bootstrap] PgBoss queue service successfully initialized.");

    // Verify the BGE reranker can load before accepting any work.
    // If it fails, crash hard — product matching silently returning null
    // for every query is worse than a startup failure that gets noticed.
    sysLog.info("🧠 [Bootstrap] Loading BGE reranker (first load downloads ~571 MB from HuggingFace)...");
    await ensureRerankerReady();
    sysLog.info("🧠 [Bootstrap] BGE reranker loaded OK.");

    // Execution path for background WORKER profiles
    if (PROCESS_PROFILE === "WORKER" || PROCESS_PROFILE === "COMBINED") {
      sysLog.info("👷 [Bootstrap] PROCESS_PROFILE includes WORKER. Registering workers and cron schedules...");
      
      // Register long-running task processors
      await WorkerRegistry.registerWorkers();
      
      // Start the core AI live loop integration orchestrator
      await startOrchestratorWorker();
      startAiTriageWorker();
      
      // Load standard scheduled background cron behaviors
      await SchedulerRegistry.registerSchedules();

      sysLog.info("👷 [Bootstrap] Queue workers and cron schedules loaded.");

      // Run telegram long-poll loops exclusively in the designated worker layer
      sysLog.info("🤖 [Bootstrap] Booting long-running Telegram polling loops...");
      startTelegramPolling().catch((err) => {
        sysLog.error("❌ Failed to initiate Telegram polling loop", err);
      });
    } else {
      sysLog.info("👷 [Bootstrap] PROCESS_PROFILE is WEB. Skipping background consumer registration.");
    }

    // Execution path for web-facing Express profiles
    if (PROCESS_PROFILE === "WEB" || PROCESS_PROFILE === "COMBINED") {
      sysLog.info("🌐 [Bootstrap] PROCESS_PROFILE includes WEB. Launching Express web server...");
      
      server.listen(PORT, "0.0.0.0", () => {
        sysLog.info(`🚀 LeadSync backend listening on address 0.0.0.0 on port ${PORT}`);

        // Set up webhook registrations or administrative webhook endpoints
        sysLog.info("🔌 [Bootstrap] Booting administrative Telegram webhook initializers...");
        initializeTelegramWebhooks().catch((err) => {
          sysLog.error("❌ Failed to initialize Telegram API Webhooks", err);
        });
      });
    } else {
      sysLog.info("🌐 [Bootstrap] Skipping Express Web server setup. Listening purely on background event queue.");
    }
  } catch (err: any) {
    sysLog.error("❌ FATAL: Application bootstrap failed recursively", err);
    process.exit(1);
  }
}

bootstrap();
