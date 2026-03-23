// Safe environment loading — VITE_API_URL is the single source of truth.
// Must be a full absolute URL with protocol (http:// or https://)

// IMMEDIATE DEBUG: Check environment variable at module load
console.log('=== MODULE LOAD DEBUG ===');
console.log('Raw import.meta.env.VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('Type of VITE_API_URL:', typeof import.meta.env.VITE_API_URL);

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
let API_BASE: string;

// Validate VITE_API_URL is a proper absolute URL
if (!rawApiUrl) {
  throw new Error('VITE_API_URL is not defined in environment variables');
}

if (!rawApiUrl.startsWith('http://') && !rawApiUrl.startsWith('https://')) {
  throw new Error(`VITE_API_URL must be a full absolute URL starting with http:// or https://. Got: "${rawApiUrl}"`);
}

API_BASE = rawApiUrl.replace(/\/$/, ""); // Remove trailing slash

console.log('Validated API_BASE:', API_BASE);
console.log('========================');

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

  // DEBUG: Log URL construction details
  console.log('=== API FETCH DEBUG ===');
  console.log('1. endpoint:', endpoint);
  console.log('2. API_BASE:', API_BASE);
  console.log('3. import.meta.env.VITE_API_URL:', import.meta.env.VITE_API_URL);
  
  const finalUrl = `${API_BASE}${endpoint}`;
  console.log('4. finalUrl constructed:', finalUrl);
  console.log('========================');

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
