"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.API_BASE = void 0;
exports.API_BASE = process.env.API_BASE_URL || "http://localhost:4000/api";
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${exports.API_BASE}${endpoint}`, {
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
exports.api = {
    get: (e) => apiFetch(e),
    post: (e, b) => apiFetch(e, { method: "POST", body: b }),
    put: (e, b) => apiFetch(e, { method: "PUT", body: b }),
    patch: (e, b) => apiFetch(e, { method: "PATCH", body: b }),
    delete: (e) => apiFetch(e, { method: "DELETE" }),
};
