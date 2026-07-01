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
  static async acquireOrRefreshLease(companyId: string, type: string = "TELEGRAM"): Promise<boolean> {
    return true;
  }

  static async isAuthorizedToConsume(companyId: string, type: string = "TELEGRAM"): Promise<boolean> {
    return true;
  }

  static startHeartbeatLoop() {
    // No-op
  }
}
