// ✅ Safe environment loading
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "https://startup-production-77de.up.railway.app/api";

// 🔍 Debug (remove later in production if you want)
console.log("API BASE:", API_BASE);

// ✅ Added PATCH here
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
}

async function apiFetch(endpoint: string, options: ApiOptions = {}) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
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

  post: (endpoint: string, body?: any) =>
    apiFetch(endpoint, { method: "POST", body }),

  put: (endpoint: string, body?: any) =>
    apiFetch(endpoint, { method: "PUT", body }),

  // ✅ NEW PATCH METHOD
  patch: (endpoint: string, body?: any) =>
    apiFetch(endpoint, { method: "PATCH", body }),

  delete: (endpoint: string) =>
    apiFetch(endpoint, { method: "DELETE" }),
};
