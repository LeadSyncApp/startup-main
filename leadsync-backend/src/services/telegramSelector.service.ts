import { prisma } from "../lib/prisma";

export const INSTANCE_ID = Math.random().toString(36).substring(2, 10) + "_" + process.pid;

// Determine environment: Cloud Run port is always 3000, development backend runs on 4000 or localhost
export const IS_LOCAL =
  !process.env.API_BASE_URL ||
  process.env.API_BASE_URL.includes("localhost") ||
  process.env.API_BASE_URL.includes("127.0.0.1") ||
  process.env.API_BASE_URL.includes("ais-dev-") ||
  process.env.API_BASE_URL.includes("ais-pre-") ||
  (process.env.PORT && parseInt(process.env.PORT, 10) !== 3000) ||
  process.env.NODE_ENV === "development";

// Role-based PRIMARY/PASSIVE selection
const envRole = process.env.TELEGRAM_CONSUMER_ROLE;
export const MY_ROLE = envRole === "PRIMARY" || envRole === "PASSIVE" 
  ? envRole 
  : (IS_LOCAL ? "PRIMARY" : "PASSIVE");

console.log(`🤖 [Telegram Selector] Instance ID: ${INSTANCE_ID} | Env: ${IS_LOCAL ? "LOCAL" : "CLOUD"} | Role: ${MY_ROLE}`);

export class TelegramLeaseService {
  /**
   * Refreshes the database lease to announce this instance is the active PRIMARY consumer.
   */
  static async acquireOrRefreshLease(companyId: string): Promise<boolean> {
    if (MY_ROLE !== "PRIMARY") {
      return false;
    }

    const leaseData = {
      activeInstanceId: INSTANCE_ID,
      role: "PRIMARY",
      environment: "LOCAL",
      lastHeartbeat: new Date().toISOString(),
    };

    try {
      const existing = await prisma.botKnowledge.findFirst({
        where: {
          companyId,
          type: "TELEGRAM_CONSUMER_LEASE",
          title: "active_lease",
        },
      });

      if (existing) {
        await prisma.botKnowledge.update({
          where: { id: existing.id },
          data: {
            content: JSON.stringify(leaseData),
            isActive: true,
          },
        });
      } else {
        await prisma.botKnowledge.create({
          data: {
            companyId,
            type: "TELEGRAM_CONSUMER_LEASE",
            title: "active_lease",
            content: JSON.stringify(leaseData),
            isActive: true,
          },
        });
      }
      return true;
    } catch (err: any) {
      console.error(`❌ [Telegram Lease] Fault updating lease for company ${companyId}:`, err.message);
      return false;
    }
  }

  /**
   * Checks database lease to decide if this instance is authorized.
   * If PRIMARY role, returns true and refreshes lease in background.
   * If PASSIVE, returns true ONLY if the registered PRIMARY heartbeat has expired (>30 seconds old or missing).
   */
  static async isAuthorizedToConsume(companyId: string): Promise<boolean> {
    if (MY_ROLE === "PRIMARY") {
      this.acquireOrRefreshLease(companyId).catch(() => {});
      return true;
    }

    try {
      const existing = await prisma.botKnowledge.findFirst({
        where: {
          companyId,
          type: "TELEGRAM_CONSUMER_LEASE",
          title: "active_lease",
        },
      });

      if (!existing) {
        return true; // No primary is running, safe to consume
      }

      const lease = JSON.parse(existing.content);
      const heartbeatTime = new Date(lease.lastHeartbeat).getTime();
      const ageMs = Date.now() - heartbeatTime;

      // If there is an active PRIMARY instance that updated its heartbeat in the last 30 seconds, stand down!
      if (lease.activeInstanceId !== INSTANCE_ID && lease.role === "PRIMARY" && ageMs < 30000) {
        return false;
      }

      return true; // Lease expired or matches current instance
    } catch (err: any) {
      console.error(`❌ [Telegram Lease] Error validating lease for company ${companyId}:`, err.message);
      return true; // Fallback to safe mode
    }
  }

  /**
   * Spawns a background heartbeat timer for primary instances.
   */
  static startHeartbeatLoop() {
    if (MY_ROLE !== "PRIMARY") {
      return;
    }

    const intervalMs = 10000; // Refresh every 10s
    console.log(`❤️ [Telegram Lease] Starting active PRIMARY consumer heartbeat loop (every ${intervalMs / 1000}s)...`);

    const refreshAll = async () => {
      try {
        const companies = await prisma.company.findMany({
          where: {
            telegramBotToken: { not: null },
            telegramConnected: true,
          },
        });

        for (const company of companies) {
          await this.acquireOrRefreshLease(company.id);
        }
      } catch (err: any) {
        console.error(`❌ [Telegram Lease] Heartbeat loop query failed:`, err.message);
      } finally {
        setTimeout(refreshAll, intervalMs);
      }
    };

    setTimeout(refreshAll, 3000); // Begin loop with startup grace delay
  }
}
