import { prisma } from "../../lib/prisma";

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

console.log(`🤖 [System Lease Selector] Instance ID: ${INSTANCE_ID} | Env: ${IS_LOCAL ? "LOCAL" : "CLOUD"} | Role: ${MY_ROLE}`);

export class TelegramLeaseService {
  /**
   * Refreshes the database lease to announce this instance is the active PRIMARY consumer.
   * Leverages cooperative locking: will NOT overwrite an unexpired lease held by another instance.
   */
  static async acquireOrRefreshLease(companyId: string, type: string = "TELEGRAM"): Promise<boolean> {
    if (MY_ROLE !== "PRIMARY") {
      return false;
    }

    const now = new Date();
    const leaseMeta = {
      activeInstanceId: INSTANCE_ID,
      role: "PRIMARY",
      environment: IS_LOCAL ? "LOCAL" : "CLOUD",
      lastHeartbeat: now.toISOString(),
    };

    try {
      const existing = await prisma.systemLease.findUnique({
        where: {
          companyId_type: {
            companyId,
            type,
          },
        },
      });

      if (existing) {
        let existingMeta: any = null;
        try {
          existingMeta = JSON.parse(existing.content);
        } catch (e) {}

        const heartbeatTime = new Date(existing.lastHeartbeat).getTime();
        const ageMs = Date.now() - heartbeatTime;

        // Cooperative Lock: If another instance owns a valid unexpired lease (< 30s), stand down!
        if (
          existingMeta &&
          existingMeta.activeInstanceId !== INSTANCE_ID &&
          existing.isActive &&
          ageMs < 30000
        ) {
          // Do not log too frequently to prevent spamming
          if (Math.random() < 0.1) {
            console.log(`ℹ️ [SystemLease] ${type} lease for company ${companyId} is held by active instance: ${existingMeta.activeInstanceId} (age ${Math.round(ageMs/1000)}s). Standing down cooperative lock.`);
          }
          return false;
        }

        // We own it, or it expired, or inactive: update lease
        await prisma.systemLease.update({
          where: { id: existing.id },
          data: {
            activeInstanceId: INSTANCE_ID,
            role: "PRIMARY",
            content: JSON.stringify(leaseMeta),
            isActive: true,
            lastHeartbeat: now,
          },
        });
      } else {
        // Create brand new lease
        await prisma.systemLease.create({
          data: {
            companyId,
            type,
            activeInstanceId: INSTANCE_ID,
            role: "PRIMARY",
            content: JSON.stringify(leaseMeta),
            isActive: true,
            lastHeartbeat: now,
          },
        });
      }
      return true;
    } catch (err: any) {
      console.error(`❌ [SystemLease] Fault updating lease for company ${companyId} [${type}]:`, err.message);
      return false;
    }
  }

  /**
   * Checks database lease to decide if this instance is authorized.
   * If PRIMARY role, returns true only if it holds the active lease or can acquire it.
   * If PASSIVE, returns true ONLY if the registered PRIMARY heartbeat has expired (>30 seconds old or missing).
   */
  static async isAuthorizedToConsume(companyId: string, type: string = "TELEGRAM"): Promise<boolean> {
    if (MY_ROLE === "PRIMARY") {
      const acquired = await this.acquireOrRefreshLease(companyId, type);
      return acquired;
    }

    try {
      const existing = await prisma.systemLease.findUnique({
        where: {
          companyId_type: {
            companyId,
            type,
          },
        },
      });

      if (!existing) {
        return true; // No primary has registered yet, safe fallback
      }

      const heartbeatTime = new Date(existing.lastHeartbeat).getTime();
      const ageMs = Date.now() - heartbeatTime;

      let existingMeta: any = null;
      try {
        existingMeta = JSON.parse(existing.content);
      } catch (e) {}

      // Stand down if active PRIMARY registered and updated within last 30 seconds
      if (
        existingMeta &&
        existingMeta.activeInstanceId !== INSTANCE_ID &&
        existing.isActive &&
        ageMs < 30000
      ) {
        return false;
      }

      return true; // Expired or matching current instance
    } catch (err: any) {
      console.error(`❌ [SystemLease] Error validating lease for company ${companyId} [${type}]:`, err.message);
      return true; // Safe fallback
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
    console.log(`❤️ [SystemLease] Starting active PRIMARY consumer heartbeat loop (every ${intervalMs / 1000}s)...`);

    const refreshAll = async () => {
      try {
        // Refresh Telegram Polling Leases
        const telegramConnectedCompanies = await prisma.company.findMany({
          where: {
            telegramBotToken: { not: null },
            telegramConnected: true,
          },
        });

        for (const company of telegramConnectedCompanies) {
          await this.acquireOrRefreshLease(company.id, "TELEGRAM");
        }

        // Refresh Instagram Leases
        const instagramConnectedCompanies = await prisma.company.findMany({
          where: {
            instagramPageAccessToken: { not: null },
            instagramConnected: true,
          },
        });

        for (const company of instagramConnectedCompanies) {
          await this.acquireOrRefreshLease(company.id, "INSTAGRAM");
        }
      } catch (err: any) {
        console.error(`❌ [SystemLease] Heartbeat loop query failed:`, err.message);
      } finally {
        setTimeout(refreshAll, intervalMs);
      }
    };

    setTimeout(refreshAll, 3000); // Begin loop with startup grace delay
  }
}
