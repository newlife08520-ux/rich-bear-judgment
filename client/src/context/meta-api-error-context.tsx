import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MetaErrorActionability } from "@/lib/meta-error-actionability";

type MetaApiErrorState = (MetaErrorActionability & { at: number }) | null;

const MetaApiErrorContext = createContext<{
  lastError: MetaApiErrorState;
  reportMetaApiError: (a: MetaErrorActionability) => void;
  clearMetaApiError: () => void;
} | null>(null);

const TTL_MS = 15 * 60 * 1000;

export function MetaApiErrorProvider({ children }: { children: ReactNode }) {
  const [lastError, setLastError] = useState<MetaApiErrorState>(null);

  const reportMetaApiError = useCallback((a: MetaErrorActionability) => {
    setLastError({ ...a, at: Date.now() });
  }, []);

  const clearMetaApiError = useCallback(() => {
    setLastError(null);
  }, []);

  const value = useMemo(
    () => ({ lastError, reportMetaApiError, clearMetaApiError }),
    [lastError, reportMetaApiError, clearMetaApiError],
  );

  return <MetaApiErrorContext.Provider value={value}>{children}</MetaApiErrorContext.Provider>;
}

export function useMetaApiError() {
  const ctx = useContext(MetaApiErrorContext);
  if (!ctx) {
    return {
      lastError: null as MetaApiErrorState,
      reportMetaApiError: (_a: MetaErrorActionability) => {},
      clearMetaApiError: () => {},
      isStale: true,
    };
  }
  const stale = !ctx.lastError || Date.now() - ctx.lastError.at > TTL_MS;
  return { ...ctx, isStale: stale };
}

export function useReportMetaApiError() {
  return useMetaApiError().reportMetaApiError;
}
