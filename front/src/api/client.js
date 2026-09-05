// Thin fetch wrapper for the Sansyar Go API (base path /api/v1).

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1";

const TOKEN_KEY = "sansyar.access_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Persist the access token. With `remember` the token survives a browser
 * restart (localStorage); otherwise it lives only for the tab session
 * (sessionStorage). Passing a falsy token clears both stores (logout).
 */
export function setToken(token, { remember = true } = {}) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (!token) return;
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...cartTokenHeader(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message = data?.error || data?.message || "خطایی رخ داد";
    throw new Error(message);
  }
  return data;
}

// ---- Store cart token -------------------------------------------------

const CART_TOKEN_KEY = "sansyar.cart_token";

/**
 * Guest carts are keyed by a token the backend hands out on the first add;
 * we persist it and attach it to every store request (it merges into the
 * user's cart at login, server-side).
 */
export function getCartToken() {
  return localStorage.getItem(CART_TOKEN_KEY) || "";
}

export function setCartToken(token) {
  if (token) localStorage.setItem(CART_TOKEN_KEY, token);
  else localStorage.removeItem(CART_TOKEN_KEY);
}

function cartTokenHeader() {
  const token = getCartToken();
  return token ? { "X-Cart-Token": token } : {};
}

export async function apiUpload(file, { folder = "uploads", admin = false } = {}) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const path = admin ? "/admin/uploads" : "/owner/uploads";
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message = data?.error || data?.message || "خطا در آپلود تصویر";
    throw new Error(message);
  }
  return data;
}
