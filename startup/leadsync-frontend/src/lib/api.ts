// Safe environment loading — VITE_API_URL is the single source of truth.
// Use the build-time VITE_API_URL when provided. Otherwise fall back to a sensible
// runtime default that points at the same origin + /api (useful for preview or
// when frontend & backend are proxied).
const buildTimeApi = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
let API_BASE: string;

// Debug logging to identify URL construction issues
console.log('VITE_API_URL from env:', import.meta.env.VITE_API_URL);
console.log('buildTimeApi after processing:', buildTimeApi);

if (buildTimeApi && buildTimeApi !== 'undefined') {
  API_BASE = buildTimeApi;
} else if (typeof window !== "undefined") {
  // runtime fallback: use current origin and /api
  API_BASE = `${window.location.origin}/api`;
} else {
  // server-side / build-time fallback for local tooling
  API_BASE = "http://localhost:4000/api";
}

console.log('Final API_BASE:', API_BASE);

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

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
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
      throw new Error(errorData.message || "API Error");
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

  delete: (endpoint: string) =>
    apiFetch(endpoint, { method: "DELETE" }),
};
