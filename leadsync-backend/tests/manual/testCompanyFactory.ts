import { prisma } from "../../src/lib/prisma";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Secondary Defense-in-Depth: Static Blocklist of off-limits company IDs.
 */
export const OFF_LIMITS_COMPANY_IDS = [
  "3102a85e", // Production Company (real)
  "6e91a188", // MD Homemades (existing test)
  "b136e450", // JJ Enterprise (existing test)
  "company-demo-001", // Demo Company
];

// Path to orphaned company tracker JSON file
const ORPHAN_TRACKER_PATH = path.join(__dirname, ".orphaned-test-companies.json");

// In-memory allowlist of active test company IDs created by this factory process
const activeFactoryCompanyIds = new Set<string>();

/**
 * Reads orphaned test company IDs from disk.
 */
function readOrphanTracker(): string[] {
  try {
    if (fs.existsSync(ORPHAN_TRACKER_PATH)) {
      const data = fs.readFileSync(ORPHAN_TRACKER_PATH, "utf8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error("Failed to read orphan tracker file:", err);
  }
  return [];
}

/**
 * Writes orphaned test company IDs to disk.
 */
function writeOrphanTracker(ids: string[]): void {
  try {
    fs.writeFileSync(ORPHAN_TRACKER_PATH, JSON.stringify(Array.from(new Set(ids)), null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write orphan tracker file:", err);
  }
}

/**
 * Registers a newly created test company ID in memory and on disk.
 */
function registerTestCompany(companyId: string): void {
  activeFactoryCompanyIds.add(companyId);
  const orphans = readOrphanTracker();
  orphans.push(companyId);
  writeOrphanTracker(orphans);
}

/**
 * Unregisters a test company ID upon successful cleanup.
 */
function unregisterTestCompany(companyId: string): void {
  activeFactoryCompanyIds.delete(companyId);
  const orphans = readOrphanTracker().filter((id) => id !== companyId);
  writeOrphanTracker(orphans);
}

/**
 * Primary Guard (Allowlist) + Secondary Guard (Blocklist) assertion.
 */
export function assertCanModifyCompany(companyId: string): void {
  if (!companyId) {
    throw new Error("⛔ HARD SECURITY GUARD: companyId is null or empty!");
  }

  // 1. Secondary Defense-in-Depth: Blocklist Check
  const isExplicitlyBlocked = OFF_LIMITS_COMPANY_IDS.some((blocked) =>
    companyId.toLowerCase().includes(blocked.toLowerCase())
  );
  if (isExplicitlyBlocked) {
    throw new Error(
      `⛔ HARD SECURITY GUARD (Blocklist): Company ID '${companyId}' is explicitly OFF LIMITS for manual tests!`
    );
  }

  // 2. Primary Guard: Strict Allowlist Check
  const orphans = readOrphanTracker();
  const isTracked = activeFactoryCompanyIds.has(companyId) || orphans.includes(companyId);
  if (!isTracked) {
    throw new Error(
      `⛔ HARD SECURITY GUARD (Allowlist): Company ID '${companyId}' was NOT created by testCompanyFactory! Refusing to mutate or delete.`
    );
  }
}

/**
 * Creates a disposable, isolated test company with isTest: true and a unique mock token.
 */
export async function createTestCompany(tag = "SUITE") {
  const code = `T${Math.floor(100000 + Math.random() * 900000)}`;
  const companyName = `AUTOTEST-${tag}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const mockToken = `123456789:AUTOTEST_${crypto.randomBytes(6).toString("hex")}`;

  const company = await prisma.company.create({
    data: {
      name: companyName,
      companyCode: code,
      isTest: true,
      telegramBotToken: mockToken,
    },
  });

  registerTestCompany(company.id);
  console.log(`🏭 [TestCompanyFactory] Created disposable company: "${company.name}" (ID: ${company.id})`);
  return company;
}

/**
 * FK-safe cascading deletion of a disposable test company.
 * STRICTLY EXCLUDES InventoryProduct and inventory-related tables.
 */
export async function cleanupTestCompany(companyId: string | null | undefined): Promise<void> {
  if (!companyId) return;

  // Enforce Primary Allowlist & Secondary Blocklist guards
  assertCanModifyCompany(companyId);

  // Safety check: verify database record has isTest = true
  const dbCompany = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, isTest: true, name: true },
  });

  if (dbCompany && !dbCompany.isTest) {
    throw new Error(
      `⛔ SAFETY ERROR: Company '${companyId}' (${dbCompany.name}) does not have isTest=true in DB! Refusing cleanup.`
    );
  }

  console.log(`🧹 [TestCompanyFactory] Initiating FK-safe cascade cleanup for test company: ${companyId}...`);

  try {
    // 1. Delete Rule KnowledgeChunks & Logs
    await prisma.$executeRawUnsafe(`DELETE FROM "KnowledgeChunk" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "ConversationalRuleLog" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "ConversationalRule" WHERE "companyId" = $1`, companyId).catch(() => {});

    // 2. Delete Order child tables first (FK-safe ordering)
    await prisma.$executeRawUnsafe(`DELETE FROM "Invoice" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "OrderItem" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "OrderLog" WHERE "companyId" = $1`, companyId).catch(() => {});

    // 3. Delete Orders & DraftOrders
    await prisma.$executeRawUnsafe(`DELETE FROM "DraftOrder" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "Order" WHERE "companyId" = $1`, companyId).catch(() => {});

    // 4. Delete Conversation child tables & Messages
    await prisma.$executeRawUnsafe(`DELETE FROM "Message" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "ClaimLog" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "InternalNote" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "ConversationActivity" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "RuleDecisionLog" WHERE "companyId" = $1`, companyId).catch(() => {});

    // 5. Delete Conversations & Leads
    await prisma.$executeRawUnsafe(`DELETE FROM "Conversation" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "companyId" = $1`, companyId).catch(() => {});

    // 6. Delete Company-level non-inventory rollups/leases
    await prisma.$executeRawUnsafe(`DELETE FROM "CompanyPollingLease" WHERE "companyId" = $1`, companyId).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "CompanyAnalyticsRollup" WHERE "companyId" = $1`, companyId).catch(() => {});

    // 7. Finally delete the Company record itself
    await prisma.$executeRawUnsafe(`DELETE FROM "Company" WHERE "id" = $1`, companyId).catch(() => {});

    unregisterTestCompany(companyId);
    console.log(`✅ [TestCompanyFactory] Cleaned up disposable test company: ${companyId}`);
  } catch (err: any) {
    console.error(`❌ [TestCompanyFactory] Failed to clean up test company ${companyId}:`, err);
  }
}

/**
 * Purges any orphaned test companies recorded in the tracker file from past crashed runs.
 */
export async function purgeOrphanedTestCompanies(): Promise<void> {
  const orphans = readOrphanTracker();
  if (orphans.length === 0) return;

  console.log(`🧹 [TestCompanyFactory] Found ${orphans.length} orphaned test company ID(s). Purging...`);
  for (const companyId of [...orphans]) {
    try {
      activeFactoryCompanyIds.add(companyId); // Temporarily allow for purge
      await cleanupTestCompany(companyId);
    } catch (e: any) {
      console.error(`Failed purging orphan ${companyId}: ${e.message}`);
    }
  }
}

/**
 * Helper wrapper: executes test logic within a managed disposable company lifecycle.
 */
export async function withTestCompany<T>(
  tag: string,
  fn: (company: Awaited<ReturnType<typeof createTestCompany>>) => Promise<T>
): Promise<T> {
  await purgeOrphanedTestCompanies();
  const company = await createTestCompany(tag);
  try {
    return await fn(company);
  } finally {
    await cleanupTestCompany(company.id);
  }
}
