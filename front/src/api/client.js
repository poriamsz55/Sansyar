// Thin fetch wrapper for the Sansyar Go API (base path /api/v1).
//
// This MVP renders from local mock data (see src/data/mock.js) so it runs with
// no backend, but every screen is built around these calls. Flip the flag in
// src/api/endpoints.js to talk to the real server once it is running.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1";

const TOKEN_KEY = "sansyar.access_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.error || data?.message || "خطایی رخ داد";
    throw new Error(message);
  }
  return data;
}
