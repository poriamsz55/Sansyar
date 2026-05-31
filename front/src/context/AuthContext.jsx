import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin } from "../api/endpoints";
import { setToken } from "../api/client";

const AuthContext = createContext(null);
const USER_KEY = "sansyar.user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  async function login(credentials) {
    const u = await apiLogin(credentials);
    setUser(u);
    return u;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  const value = {
    user,
    login,
    logout,
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
