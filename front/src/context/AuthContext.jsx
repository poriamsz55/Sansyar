import { createContext, useContext, useState } from "react";
import {
  login as apiLogin,
  verifyOtp as apiVerifyOtp,
  registerOwner as apiRegisterOwner,
} from "../api/endpoints";
import { setToken } from "../api/client";

const AuthContext = createContext(null);
const USER_KEY = "sansyar.user";

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Persist the user alongside the token so a "remember me" session survives a
// browser restart while a non-remembered one does not.
function persistUser(user, remember = true) {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
  if (!user) return;
  (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  async function login(credentials) {
    const remember = credentials.rememberMe ?? true;
    const u = await apiLogin(credentials);
    persistUser(u, remember);
    setUser(u);
    return u;
  }

  async function register(payload) {
    const u = await apiRegisterOwner(payload);
    persistUser(u, true);
    setUser(u);
    return u;
  }

  async function loginWithOtp(phone, code) {
    const u = await apiVerifyOtp(phone, code);
    persistUser(u, true);
    setUser(u);
    return u;
  }

  function logout() {
    setToken(null);
    persistUser(null);
    setUser(null);
  }

  // Merge freshly-fetched/edited profile fields into the stored session user
  // (e.g. after PATCH /me) without forcing a re-login.
  function updateUser(patch) {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      const remember = !!localStorage.getItem(USER_KEY);
      persistUser(next, remember);
      return next;
    });
  }

  const value = {
    user,
    login,
    register,
    loginWithOtp,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === "super_admin",
    isVenueOwner: user?.role === "venue_owner" || user?.role === "venue_manager",
    isAdmin: user?.role === "super_admin" || user?.role === "venue_owner",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
