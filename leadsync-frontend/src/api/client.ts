import axios from "axios";
import { activityToast as toast } from "../features/activity-ledger/useActivityStore";

const API_BASE = import.meta.env.VITE_API_URL?.trim() || "/api";

/**
 * LeadSync Multi-Tenant Unified Axios Client
 * Handles token inclusion and centralized error-boundary routing (like auth expiry, client rate limiting, and RBAC security).
 */
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Request Interceptor: Automatically inject authorization header
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("token") || localStorage.getItem("access_token");
    if (accessToken && config.headers) {
      if (typeof config.headers.set === "function") {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
      } else {
        config.headers["Authorization"] = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Manages token expirations, client cooldown rates, and privilege breaches
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, headers, config } = error.response;

      // COMPONENT: HTTP 429 Rate-Limit Cooldown Interceptor
      if (status === 429) {
        const retryAfterHeader = headers?.["retry-after"] || headers?.["Retry-After"] || headers?.["retry_after"];
        let seconds = 60; // Safe default cooldown

        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed)) {
            seconds = parsed;
          }
        }
        toast.error(`Rate limit exceeded! System restricted for safety. Cooldown active: ${seconds}s.`);
      }

      // COMPONENT: HTTP 401 Session Expiry Guard
      if (status === 401) {
        const urlPath = config.url || "";
        // Do not intercept standard credentials validation pages during ongoing auth
        if (!urlPath.includes("/auth/login") && !urlPath.includes("/auth/signup")) {
          console.error("Session expired or invalid key. Performing client cleanup...");
          localStorage.removeItem("token");
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          localStorage.removeItem("company");
          window.location.href = "/login";
        }
      }

      // COMPONENT: HTTP 403 Role Privilege Interceptor (RBAC Warnings)
      if (status === 403) {
        console.warn("RBAC Violation: Logged-in user lacks necessary roles or clearance.");
        toast.error("Access Forbidden: Your user role lacks authorizations for this resource.");
      }
    }
    return Promise.reject(error);
  }
);

export { apiClient };

// ── Rule Groups API ─────────────────────────────────────────────

/**
 * Create a new rule group (automation flow)
 */
export async function createRuleGroup(name: string, description: string, type: string = "AI_INSTRUCTION") {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Company not found");
  const res = await authedFetch("/api/automation/rule-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, name, description, type }),
  });
  if (!res.ok) throw new Error("Failed to create rule group");
  return res.json();
}

/**
 * List all rule groups for the company
 */
export async function listRuleGroups(type?: string) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Company not found");
  let url = `/api/automation/rule-groups/${companyId}`;
  if (type) url += `?type=${type}`;
  const res = await authedFetch(url);
  if (!res.ok) throw new Error("Failed to list rule groups");
  return res.json();
}

/**
 * Get a single rule group with its rules
 */
export async function getRuleGroup(id: string) {
  const res = await authedFetch(`/api/automation/rule-groups/detail/${id}`);
  if (!res.ok) throw new Error("Failed to get rule group");
  return res.json();
}

/**
 * Delete a rule group
 */
export async function deleteRuleGroup(id: string) {
  const res = await authedFetch(`/api/automation/rule-groups/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete rule group");
  return res.json();
}

/**
 * Update a rule group (e.g. toggle isEnabled / rename)
 */
export async function updateRuleGroup(id: string, data: any) {
  const res = await authedFetch(`/api/automation/rule-groups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update rule group");
  return res.json();
}

/**
 * Authenticated fetch — reads JWT from localStorage and sends Authorization header.
 * Use this in places that need the same token handling as axios apiClient.
 */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = localStorage.getItem("token") || localStorage.getItem("access_token");
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  // If the url is relative (starts with /), prefix with the API base
  const fullUrl = url.startsWith("/") ? `${API_BASE}${url}` : url;
  return fetch(fullUrl, { ...options, headers, credentials: "include" });
}

/**
 * Get company ID from localStorage (parsed from stored company JSON)
 */
export function getCompanyId(): string | null {
  try {
    const storedCompany = localStorage.getItem("company");
    if (storedCompany) {
      const company = JSON.parse(storedCompany);
      return company.id || null;
    }
  } catch {
    // ignore
  }
  return null;
}

// ── Smart Rules API ──────────────────────────────────────────────

/**
 * Get company info from localStorage (name + business type for AI context)
 */
function getCompanyContext(): { businessName?: string; businessType?: string } {
  try {
    const storedCompany = localStorage.getItem("company");
    if (storedCompany) {
      const company = JSON.parse(storedCompany);
      return {
        businessName: company.name || undefined,
        businessType: company.botBusinessType || undefined,
      };
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Generate conversational rules from a plain-text prompt
 * Sends shop context (name, type) to AI for better rule generation
 */
export async function generateSmartRules(prompt: string, groupId?: string) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error("Company not found. Please ensure you are logged in.");
  }
  const { businessName, businessType } = getCompanyContext();
  const res = await authedFetch("/api/automation/conversational-rules/generate-from-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, companyId, groupId, businessName, businessType }),
  });
  if (!res.ok) throw new Error("Failed to generate smart rules");
  return res.json();
}

/**
 * Create a conversational rule
 */
export async function createSmartRule(data: any) {
  const companyId = getCompanyId();
  const body = JSON.stringify({ ...data, companyId });
  const res = await authedFetch("/api/automation/conversational-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error("Failed to create rule");
  return res.json();
}

/**
 * List all conversational rules for the company
 */
export async function listSmartRules(groupId?: string) {
  const companyId = getCompanyId();
  let url = `/api/automation/conversational-rules/${companyId}`;
  if (groupId) url += `?groupId=${groupId}`;
  const res = await authedFetch(url);
  if (!res.ok) throw new Error("Failed to list rules");
  return res.json();
}

/**
 * Update a conversational rule
 */
export async function updateSmartRule(ruleId: string, data: any) {
  const res = await authedFetch(`/api/automation/conversational-rules/${ruleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update rule");
  return res.json();
}

/**
 * Delete a conversational rule
 */
export async function deleteSmartRule(ruleId: string) {
  const res = await authedFetch(`/api/automation/conversational-rules/${ruleId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete rule");
  return res.json();
}

/**
 * Test a conversational rule against a sample message
 * Backend expects: POST /api/automation/conversational-rules/test with { ruleId, sampleMessage }
 */
export async function testConversationalRule(ruleId: string, sampleMessage: string) {
  const res = await authedFetch("/api/automation/conversational-rules/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ruleId, sampleMessage }),
  });
  if (!res.ok) throw new Error("Failed to test rule");
  return res.json();
}

// Alias for backwards compatibility
export const testSmartRule = testConversationalRule;

/**
 * Fetch surfacing + event catalog constants from the backend so the rule editor
 * cannot drift from backend truth (cap, event names).
 */
export async function getRuleConstants() {
  const res = await authedFetch("/api/automation/conversational-rules/constants");
  if (!res.ok) throw new Error("Failed to load rule constants");
  return res.json();
}

