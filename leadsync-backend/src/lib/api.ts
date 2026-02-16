export const API_BASE = process.env.API_BASE_URL || "http://localhost:4000/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface ApiOptions {
  method?: HttpMethod;
  body?: any;
}

async function apiFetch(endpoint: string, options: ApiOptions = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "API Error");
  }

  return res.json();
}

export const api = {
  get: (e: string) => apiFetch(e),
  post: (e: string, b?: any) => apiFetch(e, { method: "POST", body: b }),
  put: (e: string, b?: any) => apiFetch(e, { method: "PUT", body: b }),
  patch: (e: string, b?: any) => apiFetch(e, { method: "PATCH", body: b }),
  delete: (e: string) => apiFetch(e, { method: "DELETE" }),
};
