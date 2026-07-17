import { AsyncLocalStorage } from "async_hooks";
import { prisma } from "../../lib/prisma";
import { cacheService } from "../infrastructure/cache.service";

export interface TenantContext {
  companyId: string;
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  priorityRules: Array<{ condition: string; field: string; thresholdValue: number; result: string }> | null;
  templates: Record<string, string>;
  // ⚡ NEW: Dynamic AI Infrastructure Profiles
  aiModelTarget: string; 
  outputProtocolSchema: "JSON_ONLY" | "HYBRID";
  intentMatrix?: string;
  localizedHeuristics?: string;
  businessRulesSchema?: string;
}

// Harness Node's native AsyncLocalStorage for dependency injection without parameter-drilling
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const context = tenantContextStorage.getStore();
  if (!context) {
    throw new Error("Execution Error: Attempted to access TenantContext outside of an active webhook transaction frame.");
  }
  return context;
}

/**
 * Resolves a full TenantContext from DB or Cache for a given companyId
 */
export async function resolveTenantContext(companyId: string): Promise<TenantContext> {
    const cacheKey = cacheService.getCompanyKey(companyId);
    let company = await cacheService.get<any>(cacheKey);

    if (!company) {
        company = await prisma.company.findUnique({
            where: { id: companyId },
            include: { botConfiguration: true }
        });

        if (!company) {
            throw new Error(`Routing Exception: No tenant registered for ID ${companyId}`);
        }

        // Cache for 5 minutes
        await cacheService.set(cacheKey, company, 300);
    }

    const config = (company.botConfiguration as any) || {};

    return {
        companyId: company.id,
        currencyCode: (company as any).currencyCode || "USD",
        currencySymbol: (company as any).currencySymbol || "$",
        timezone: (company as any).timezone || "UTC",
        priorityRules: config.priority_rules || null,
        templates: config.templates || {},
        aiModelTarget: config.ai_model_target || "llama-3.3-70b-versatile",
        outputProtocolSchema: config.output_protocol_schema || "JSON_ONLY",
        intentMatrix: config.intent_matrix,
        localizedHeuristics: config.localized_heuristics,
        businessRulesSchema: config.business_rules_schema
    };
}
