// VITE_API_URL is the single source of truth for the backend API base URL.
// Vite inlines this at build time from .env — no window.location fallback.
// If VITE_API_URL is unset the app logs a warning and falls back to same-origin /api.

// 1. Compute normalized ROOT_BASE by stripping any trailing "/api" or slashes
const rawApiUrl = import.meta.env.VITE_API_URL?.trim() || "";
if (rawApiUrl && !rawApiUrl.startsWith("http://") && !rawApiUrl.startsWith("https://")) {
  console.warn(`[API Config] ⚠️ VITE_API_URL should be a full URL starting with http:// or https://. Got: "${rawApiUrl}"`);
}
const cleanUrl = rawApiUrl.replace(/\/+$/, "");
const ROOT_BASE = cleanUrl.endsWith("/api")
  ? cleanUrl.slice(0, -4)
  : cleanUrl;

export const API_BASE = `${ROOT_BASE}/api`;

// ✅ Added PATCH here
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
}

async function apiFetch(endpoint: string, options: ApiOptions = {}) {
  const token = localStorage.getItem("token");

  const isFormData = options.body instanceof FormData;

  let finalUrl: string;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    finalUrl = endpoint;
  } else {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (path.startsWith("/api/") || path === "/api") {
      finalUrl = `${ROOT_BASE}${path}`;
    } else {
      finalUrl = `${ROOT_BASE}/api${path}`;
    }
  }

  try {
    const res = await fetch(finalUrl, {
      method: options.method || "GET",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
    });

    if (res.status === 401) {
      // 🚨 IGNORE LOGIN ENDPOINT (Wrong Password)
      if (endpoint.includes("/auth/login")) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Invalid credentials");
      }

      console.error("Unauthorized - Token missing or invalid");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
      const errorData = await res.json().catch(() => ({}));
      
      // Enhanced error message with status, endpoint, and details
      const statusText = res.statusText || 'Unknown';
      const errorMessage = errorData.message || 'API Error';
      const enhancedError = `${res.status} ${statusText} - ${errorMessage} (${endpoint})`;
      
      console.error('API Error Details:', {
        status: res.status,
        statusText,
        endpoint,
        url: finalUrl,
        message: errorMessage
      });
      
      throw new Error(enhancedError);
    }

    return res.json();
  } catch (error) {
    console.error("API Fetch Error:", error);
    throw error;
  }
}

export const api = {
  get: (endpoint: string) => apiFetch(endpoint),

  post: (endpoint: string, body?: any, headers?: Record<string, string>) =>
    apiFetch(endpoint, { method: "POST", body, headers }),

  put: (endpoint: string, body?: any, headers?: Record<string, string>) =>
    apiFetch(endpoint, { method: "PUT", body, headers }),

  // ✅ NEW PATCH METHOD
  patch: (endpoint: string, body?: any, headers?: Record<string, string>) =>
    apiFetch(endpoint, { method: "PATCH", body, headers }),

  delete: (endpoint: string, body?: any) =>
    apiFetch(endpoint, { method: "DELETE", body }),
};
