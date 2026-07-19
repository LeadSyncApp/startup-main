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

const LEASE_DURATION_MS = 10000; // 10 seconds lease duration
const HEARTBEAT_INTERVAL_MS = 4000; // Heartbeat every 4 seconds

console.log(`🤖 [System Lease Selector] Instance ID: ${INSTANCE_ID} | Env: ${IS_LOCAL ? "LOCAL" : "CLOUD"} | Role: ${MY_ROLE}`);

export class TelegramLeaseService {
  /**
   * Atomically attempts to acquire or refresh a lease for a given company.
   */
  static async acquireOrRefreshLease(companyId: string): Promise<boolean> {
    const now = new Date();
    const newExpiresAt = new Date(Date.now() + LEASE_DURATION_MS);

    try {
      // 1. Attempt to update the lease if it exists AND is either expired or already held by us
      const updateResult = await prisma.companyPollingLease.updateMany({
        where: {
          companyId,
          OR: [
            { holderInstanceId: INSTANCE_ID },
            { expiresAt: { lt: now } }
          ]
        },
        data: {
          holderInstanceId: INSTANCE_ID,
          lastHeartbeat: now,
          expiresAt: newExpiresAt
        }
      });

      if (updateResult.count > 0) {
        return true;
      }

      // 2. If no record was updated, check if the lease record exists at all
      const exists = await prisma.companyPollingLease.findUnique({
        where: { companyId },
        select: { companyId: true }
      });

      if (exists) {
        // Exists but is held by another active instance
        return false;
      }

      // 3. Lease does not exist. Attempt to create it atomically.
      // If two processes attempt this concurrently, the database unique constraint on companyId
      // will throw a PrismaClientKnownRequestError (P2002), which we catch safely.
      await prisma.companyPollingLease.create({
        data: {
          companyId,
          holderInstanceId: INSTANCE_ID,
          lastHeartbeat: now,
          expiresAt: newExpiresAt
        }
      });

      return true;
    } catch (error: any) {
      // Unique constraint violation (P2002): another instance inserted it first
      if (error.code === 'P2002') {
        return false;
      }
      console.error(`Error acquiring lease for company ${companyId}:`, error);
      return false;
    }
  }

  /**
   * Checks if this instance is authorized to consume messages for the given company.
   * Runs as a fast guard before invoking Telegram API poll cycles.
   */
  static async isAuthorizedToConsume(companyId: string): Promise<boolean> {
    // If running in PASSIVE role, ignore completely
    if (MY_ROLE === "PASSIVE") {
      return false;
    }

    // Attempt to acquire or refresh the lease
    return await this.acquireOrRefreshLease(companyId);
  }

  /**
   * Starts a heartbeat loop for all leases currently held by this instance.
   */
  static startHeartbeatLoop() {
    setInterval(async () => {
      try {
        // Find all active leases held by this instance
        const myLeases = await prisma.companyPollingLease.findMany({
          where: {
            holderInstanceId: INSTANCE_ID,
            expiresAt: { gt: new Date() }
          },
          select: { companyId: true }
        });

        // Ping/refresh each lease concurrently
        await Promise.all(
          myLeases.map(lease => this.acquireOrRefreshLease(lease.companyId))
        );
      } catch (err: any) {
        console.debug(`[TelegramLeaseService] Transient error in lease heartbeat loop: ${err?.message || String(err)}`);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }
}
