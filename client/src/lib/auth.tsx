import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiRequest } from "./queryClient";
import type { SafeUser } from "@shared/schema";

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 重新載入 /api/auth/me（例如更新 defaultProductScope 後） */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 401 = 未登入或 session 過期，預期行為；不影響首頁 action-center 等已登入後的 query
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest("POST", "/api/auth/logout");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) {
      setUser(null);
      return;
    }
    const data = (await res.json()) as SafeUser;
    setUser(data);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** 頁面級權限：admin 全開；manager 不可進 Prompt／閾值設定；user 僅主流程與設定總覽（不含進階設定子頁）。 */
export function canAccess(role: string | undefined, page: string): boolean {
  const r = role ?? "user";
  if (r === "admin") return true;

  if (r === "manager") {
    const blocked = ["/settings/prompts", "/settings/thresholds"];
    return !blocked.some((p) => page === p || page.startsWith(`${p}/`));
  }

  if (r === "user") {
    if (
      page.startsWith("/settings/prompts") ||
      page.startsWith("/settings/thresholds") ||
      page.startsWith("/settings/profit-rules")
    ) {
      return false;
    }
    const allowedRoots = ["/", "/products", "/judgment", "/fb-ads", "/tasks", "/assets", "/settings"];
    return allowedRoots.some((p) => (p === "/" ? page === "/" : page === p || page.startsWith(`${p}/`)));
  }

  return true;
}
