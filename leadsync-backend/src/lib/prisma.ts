import { PrismaClient, Prisma } from "@prisma/client";
import { sysLog } from "./logger";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  sysLog.error("FATAL: DATABASE_URL is not defined.");
  process.exit(1);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  sysLog.info("🔌 [Prisma] Instantiating new PrismaClient (establishing connection pool)...");
  const dbUrl = new URL(DATABASE_URL);
  // Increase connection pool to handle concurrent Telegram polling + staff requests
  if (!dbUrl.searchParams.has("connection_limit")) {
    dbUrl.searchParams.set("connection_limit", "10");
  }
  if (!dbUrl.searchParams.has("pool_timeout")) {
    dbUrl.searchParams.set("pool_timeout", "10");
  }
  if (!dbUrl.searchParams.has("connect_timeout")) {
    dbUrl.searchParams.set("connect_timeout", "10");
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: dbUrl.toString() } },
  });
};

// Helper: execute query with automatic retry for transient DB connection resets (P1017, P1001, ECONNRESET)
async function executeQueryWithTransientRetry<T>(queryFn: () => Promise<T>): Promise<T> {
  const MAX_RETRIES = 2;
  let attempt = 0;
  while (true) {
    try {
      return await queryFn();
    } catch (err: any) {
      attempt++;
      const errMsg = err?.message || String(err);
      const isTransientConnectionErr =
        err?.code === "P1017" ||
        err?.code === "P1001" ||
        err?.code === "P1002" ||
        errMsg.includes("Server has closed the connection") ||
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("socket hang up");

      if (isTransientConnectionErr && attempt <= MAX_RETRIES) {
        sysLog.warn(`⚠️ [Prisma] Transient DB connection error (${err?.code || errMsg}). Retrying query (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      throw err;
    }
  }
}

// Base unextended Prisma Client instance
export const basePrisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

/**
 * Global whitelist of system-wide models that do NOT contain a companyId.
 * ✨ NOTE: "notification" has been completely purged from this list to match
 * your secure tenant schema!
 */
const GLOBAL_SYSTEM_TABLES = [
  "company",
  "idempotency",
  "inventoryvariant",
  "postalpincodeindex"
];

const tenantModels = [
  'User', 'Contact', 'Deal', 'Lead', 
  'AutomationRule', 'CustomFieldDefinition', 'BotConfiguration', 
  'Order', 'Product', 'Message', 'Conversation', 'Tag'
];

/**
 * Deep recursive mutator ensuring companyId constraints exist across nested graphs.
 */
function applyTenantScopingRecursively(
  obj: any,
  tenantId: string,
  modelName: string,
  operation: string,
  isRoot: boolean = true
) {
  if (!obj || typeof obj !== "object") return;

  const lowerModelName = modelName.toLowerCase();
  if (GLOBAL_SYSTEM_TABLES.includes(lowerModelName)) {
    return;
  }

  // Handle read querying constraints ONLY at the root or within specific relation fields
  if (isRoot) {
    if ("where" in obj) {
      if (!obj.where) obj.where = {};
      // If a composite key (companyId_name, companyId_eventKey, etc.) already
      // constrains companyId, skip adding the redundant top-level companyId.
      // This prevents breaking findUnique which only accepts unique-constraint fields.
      const hasCompositeCompanyId = Object.values(obj.where).some(
        (v: any) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.companyId === 'string'
      );
      if (!hasCompositeCompanyId) {
        obj.where.companyId = tenantId;
      }
    } else if (["findMany", "findUnique", "findFirst", "update", "delete", "updateMany", "deleteMany", "count", "aggregate", "groupBy"].includes(operation)) {
      obj.where = { companyId: tenantId };
    }

    // Handle write blocks (create / update payloads)
    if (operation === "create" || operation === "createMany") {
      if (obj.data) {
        if (Array.isArray(obj.data)) {
          obj.data = obj.data.map((item: any) => {
            if (item && typeof item === "object") {
              return { ...item, companyId: tenantId };
            }
            return item;
          });
        } else {
          obj.data = { ...obj.data, companyId: tenantId };
        }
      } else {
        obj.data = { companyId: tenantId };
      }
    } else if (operation === "upsert") {
      if (obj.create) obj.create = { ...obj.create, companyId: tenantId };
      if (obj.update) obj.update = { ...obj.update, companyId: tenantId };
    }
  }

  // Process sub-relation inclusions and conditional aggregates safely
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object") {
      if (key === "include" || key === "select") {
        for (const subKey of Object.keys(val)) {
          const subVal = val[subKey];
          if (subVal && typeof subVal === "object") {
            // Skip Prisma aggregate keys (_count, _sum, _avg, _min, _max) — 
            // they don't support where clause injection at the root level
            if (subKey.startsWith('_')) continue;

            // Singular relations (1:1 or N:1) do not support 'where' in include/select
            // Also includes relation names whose models lack companyId (e.g. variants → InventoryVariant)
            const singularRelations = ['lead', 'company', 'assignedTo', 'processedBy', 'parent', 'customer', 'conversation', 'user', 'invoice', 'variants'];
            const isSingular = singularRelations.includes(subKey.toLowerCase());
            
            // Include/select payloads start a new "root" context for the joined relation
            applyTenantScopingRecursively(subVal, tenantId, subKey, isSingular ? "findUnique" : "findMany", !isSingular);
          }
        }
      } else if (key === "data" || key === "where" || key === "create" || key === "update") {
         // Prevent recursive rule application on internal prisma instruction keys
         applyTenantScopingRecursively(val, tenantId, modelName, operation, false);
      } else {
         applyTenantScopingRecursively(val, tenantId, modelName, operation, false);
      }
    }
  }
}

/**
 * ✨ THE TS REPAIR CLIENT
 * Extends the Prisma base instance with runtime isolation rules and computed LTV metrics.
 */
export const prisma = basePrisma.$extends({
  name: "tenant-isolation-wrapper",
  result: {
    lead: {
      ltvBadge: {
        needs: { totalSpend: true },
        compute(lead) {
          if (lead.totalSpend >= 10000) return 'DIAMOND';
          if (lead.totalSpend >= 5000) return 'GOLD';
          if (lead.totalSpend >= 1000) return 'SILVER';
          return 'STANDARD';
        }
      }
    }
  },
  model: {
    $allModels: {
      create<T, Args>(
        this: T,
        args: Prisma.SelectSubset<Args, Prisma.Args<T, "create">> & {
          data: Omit<Prisma.Args<T, "create">["data"], "companyId"> & { companyId?: string };
        }
      ) {
        const ctx = Prisma.getExtensionContext(this) as any;
        return ctx.$parent[ctx.$name].create(args);
      },
      createMany<T, Args>(
        this: T,
        args: Prisma.SelectSubset<Args, Prisma.Args<T, "createMany">> & {
          data: (Omit<Prisma.Args<T, "createMany">["data"], "companyId"> & { companyId?: string } | any)[];
        }
      ) {
        const ctx = Prisma.getExtensionContext(this) as any;
        return ctx.$parent[ctx.$name].createMany(args);
      }
    }
  },
  query: {
    $allModels: {
      async $allOperations(params) {
        const { model, operation, args, query } = params;
        const isTx = !!(params as any).__internalParams?.transaction;

        if (GLOBAL_SYSTEM_TABLES.includes(model.toLowerCase())) {
          return isTx ? query(args) : executeQueryWithTransientRetry(() => query(args));
        }

        // Extract tenant ID context from various possible argument paths
        const tenantId = 
          (args as any)?.companyId || 
          (args as any)?.where?.companyId || 
          // Check composite/nested unique keys (companyId_name, companyId_eventKey, etc.)
          (() => {
            const where = (args as any)?.where;
            if (where && typeof where === 'object') {
              for (const key of Object.keys(where)) {
                const val = where[key];
                if (val && typeof val === 'object' && typeof val.companyId === 'string') {
                  return val.companyId;
                }
              }
            }
            return undefined;
          })() ||
          (args as any)?.data?.companyId ||
          (Array.isArray((args as any)?.data) ? (args as any)?.data[0]?.companyId : undefined);

        // Strict fallback enforcement check for critical transactional integrity
        // We allow bypasses for bulk queries, direct ID primary key queries, or if tenant context is provided
        const isAuthBypass = model.toLowerCase() === "user" && 
          (["create", "findUnique", "findFirst"].includes(operation));

        const isBypass =
          isAuthBypass ||
          ["findMany", "createMany", "deleteMany", "updateMany", "count"].includes(operation) ||
          (args as any)?.where?.id !== undefined ||
          (args as any)?.where?.email !== undefined ||
          (args as any)?.where?.conversationId !== undefined ||
          (args as any)?.where?.tokenLookup !== undefined;

        if (!tenantId && !isBypass) {
          sysLog.error(`MANDATORY TENANCY BREACH WARNING: Attempted ${operation} on ${model} without active companyId context.`);
          throw new Error(`403 Forbidden: Missing Tenant Context Scope Assignment for target entity: ${model}`);
        }

        // Use a shallow clone for top-level args to avoid mutating input objects directly
        // Recursive mutator handles the deep property injections safely
        const scopedArgs = { ...args };
        if (tenantId) {
          applyTenantScopingRecursively(scopedArgs, tenantId, model, operation);
        }

        return isTx ? query(scopedArgs) : executeQueryWithTransientRetry(() => query(scopedArgs));
      }
    }
  }
});

/**
 * A lightweight, custom recursive utility function that deeply duplicates user query arguments
 * while explicitly preserving instances of Date, Buffer, BigInt, and standard typed array schemas.
 */
function deepClonePrismaArgs<T>(val: T): T {
  if (val === null || val === undefined) {
    return val;
  }

  const type = typeof val;

  if (type !== "object") {
    return val;
  }

  if (val instanceof Date) {
    return new Date(val.getTime()) as unknown as T;
  }

  if (val instanceof RegExp) {
    return new RegExp(val.source, val.flags) as unknown as T;
  }

  if (Buffer.isBuffer(val)) {
    return Buffer.from(val) as unknown as T;
  }

  if (val instanceof Map) {
    const mapClone = new Map();
    val.forEach((itemVal, itemKey) => {
      mapClone.set(deepClonePrismaArgs(itemKey), deepClonePrismaArgs(itemVal));
    });
    return mapClone as unknown as T;
  }

  if (val instanceof Set) {
    const setClone = new Set();
    val.forEach((itemVal) => {
      setClone.add(deepClonePrismaArgs(itemVal));
    });
    return setClone as unknown as T;
  }

  if (Array.isArray(val)) {
    const arrClone = new Array(val.length);
    for (let i = 0; i < val.length; i++) {
      arrClone[i] = deepClonePrismaArgs(val[i]);
    }
    return arrClone as unknown as T;
  }

  if (ArrayBuffer.isView(val)) {
    const typedArray = val as any;
    return new (typedArray.constructor)(
      typedArray.buffer.slice(
        typedArray.byteOffset,
        typedArray.byteOffset + typedArray.byteLength
      )
    ) as unknown as T;
  }

  const proto = Object.getPrototypeOf(val);
  if (proto === null || proto === Object.prototype) {
    const objClone = Object.create(proto);
    for (const key of Object.keys(val)) {
      objClone[key] = deepClonePrismaArgs((val as any)[key]);
    }
    return objClone as unknown as T;
  }

  return val;
}

/**
 * Generates an isolated Prisma runner client bound to a specific tenant company context window.
 */
export const getTenantPrismaContext = (companyId: string) => {
  if (!companyId) {
    throw new Error("403 Forbidden: Tenant Isolation Enforcement Violation - Missing companyId");
  }

  return basePrisma.$extends({
    name: "active-tenant-isolation",
    result: {
      lead: {
        ltvBadge: {
          needs: { totalSpend: true },
          compute(lead) {
            if (lead.totalSpend >= 10000) return 'DIAMOND';
            if (lead.totalSpend >= 5000) return 'GOLD';
            if (lead.totalSpend >= 1000) return 'SILVER';
            return 'STANDARD';
          }
        }
      }
    },
    query: {
      $allModels: {
        async $allOperations(params) {
          const { model, operation, args, query } = params;
          const isTx = !!(params as any).__internalParams?.transaction;

          if (GLOBAL_SYSTEM_TABLES.includes(model.toLowerCase())) {
            return isTx ? query(args) : executeQueryWithTransientRetry(() => query(args));
          }

          const scopedArgs = deepClonePrismaArgs(args || {});
          applyTenantScopingRecursively(scopedArgs, companyId, model, operation);
          return isTx ? query(scopedArgs) : executeQueryWithTransientRetry(() => query(scopedArgs));
        },
      },
    },
  });
};