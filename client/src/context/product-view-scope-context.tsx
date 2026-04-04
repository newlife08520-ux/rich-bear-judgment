import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import { useWorkbenchFilter } from "@/lib/workbench-filter-context";

const modeStorageKey = (userId: string) => `product-view-scope-mode:${userId}`;

export type ProductViewScopeMode = "mine" | "all";

type ProductViewScopeContextValue = {
  mode: ProductViewScopeMode;
  setMode: (m: ProductViewScopeMode) => void;
  scopeProductsForApi: string[] | undefined;
};

const ProductViewScopeContext = createContext<ProductViewScopeContextValue | null>(null);

/**
 * 單一來源：首頁／商品／投放共用「我的商品 / 全部」，避免多處 hook 互相覆寫 filter。
 */
export function ProductViewScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setProductFilter } = useWorkbenchFilter();
  const userId = user?.id ?? "";

  const [mode, setModeState] = useState<ProductViewScopeMode>("mine");

  useEffect(() => {
    if (!userId || typeof localStorage === "undefined") return;
    try {
      const v = localStorage.getItem(modeStorageKey(userId));
      setModeState(v === "all" ? "all" : "mine");
    } catch {
      setModeState("mine");
    }
  }, [userId]);

  const setMode = useCallback(
    (m: ProductViewScopeMode) => {
      setModeState(m);
      if (userId && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(modeStorageKey(userId), m);
        } catch {
          /* ignore */
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId || !user) return;
    if (mode === "all") {
      setProductFilter([]);
      return;
    }
    const scope = user.defaultProductScope;
    if (scope && scope.length > 0) {
      setProductFilter(scope);
    }
  }, [mode, userId, user, setProductFilter]);

  const scopeProductsForApi = useMemo((): string[] | undefined => {
    if (mode === "all") return undefined;
    const mine = user?.defaultProductScope;
    if (mine && mine.length > 0) return mine;
    return undefined;
  }, [mode, user?.defaultProductScope]);

  const value = useMemo(
    () => ({ mode, setMode, scopeProductsForApi }),
    [mode, setMode, scopeProductsForApi]
  );

  return <ProductViewScopeContext.Provider value={value}>{children}</ProductViewScopeContext.Provider>;
}

export function useProductViewScope(): ProductViewScopeContextValue {
  const ctx = useContext(ProductViewScopeContext);
  if (!ctx) {
    throw new Error("useProductViewScope must be used within ProductViewScopeProvider");
  }
  return ctx;
}
