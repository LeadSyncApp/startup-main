const API_BASE = 'http://localhost:4000/api'; // ✅ include /api here

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
}

async function apiFetch(
  endpoint: string,
  options: ApiOptions = {}
) {
  // ✅ FIXED: use correct key
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401) {
    console.error('Unauthorized - Token missing or invalid');
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'API Error');
  }

  return res.json();
}

export const api = {
  get: (endpoint: string) =>
    apiFetch(endpoint),

  post: (endpoint: string, body?: any) =>
    apiFetch(endpoint, { method: 'POST', body }),

  put: (endpoint: string, body?: any) =>
    apiFetch(endpoint, { method: 'PUT', body }),

  delete: (endpoint: string) =>
    apiFetch(endpoint, { method: 'DELETE' })
};
