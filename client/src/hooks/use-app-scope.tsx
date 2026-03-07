import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { AppScope } from "@shared/schema";
import { buildScopeKey, defaultAppScope } from "@shared/schema";

const STORAGE_KEY = "app-scope";

function loadScope(): AppScope {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        selectedAccountIds: parsed.selectedAccountIds || [],
        selectedPropertyIds: parsed.selectedPropertyIds || [],
        datePreset: parsed.datePreset || "7",
        customStart: parsed.customStart || undefined,
        customEnd: parsed.customEnd || undefined,
        scopeMode: parsed.scopeMode || "all",
      };
    }
  } catch {}
  return { ...defaultAppScope };
}

function persistScope(scope: AppScope) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
  } catch {}
}

function useAppScopeInternal(userId: string = "1") {
  const [scope, setScope] = useState<AppScope>(loadScope);

  const updateScope = useCallback((partial: Partial<AppScope>) => {
    setScope((prev) => {
      const next = { ...prev, ...partial };
      if (partial.selectedAccountIds || partial.selectedPropertyIds) {
        const hasSelection =
          (next.selectedAccountIds?.length || 0) > 0 ||
          (next.selectedPropertyIds?.length || 0) > 0;
        next.scopeMode = hasSelection ? "selected" : "all";
      }
      persistScope(next);
      return next;
    });
  }, []);

  const setSelectedAccounts = useCallback(
    (ids: string[]) => updateScope({ selectedAccountIds: ids }),
    [updateScope]
  );

  const setSelectedProperties = useCallback(
    (ids: string[]) => updateScope({ selectedPropertyIds: ids }),
    [updateScope]
  );

  const setDatePreset = useCallback(
    (datePreset: string) => {
      updateScope({ datePreset, customStart: undefined, customEnd: undefined });
    },
    [updateScope]
  );

  const setCustomDateRange = useCallback(
    (customStart: string, customEnd: string) => {
      updateScope({ datePreset: "custom", customStart, customEnd });
    },
    [updateScope]
  );

  const dateDisplayValue = useMemo(() => {
    if (scope.datePreset === "custom" && scope.customStart && scope.customEnd) {
      return `custom:${scope.customStart}~${scope.customEnd}`;
    }
    return scope.datePreset;
  }, [scope.datePreset, scope.customStart, scope.customEnd]);

  const handleDateChange = useCallback(
    (value: string) => {
      if (value.startsWith("custom:")) {
        const [start, end] = value.replace("custom:", "").split("~");
        if (start && end) {
          updateScope({ datePreset: "custom", customStart: start, customEnd: end });
        }
      } else {
        updateScope({ datePreset: value, customStart: undefined, customEnd: undefined });
      }
    },
    [updateScope]
  );

  const scopeKey = useMemo(
    () =>
      buildScopeKey(
        userId,
        scope.selectedAccountIds,
        scope.selectedPropertyIds,
        scope.datePreset
      ),
    [userId, scope.selectedAccountIds, scope.selectedPropertyIds, scope.datePreset]
  );

  const buildRefreshBody = useCallback(() => {
    const body: Record<string, any> = {
      selectedAccountIds: scope.selectedAccountIds,
      selectedPropertyIds: scope.selectedPropertyIds,
    };
    if (scope.datePreset === "custom" && scope.customStart && scope.customEnd) {
      body.datePreset = "custom";
      body.customStart = scope.customStart;
      body.customEnd = scope.customEnd;
    } else {
      body.datePreset = scope.datePreset;
    }
    return body;
  }, [scope]);

  return {
    ...scope,
    scopeKey,
    dateDisplayValue,
    setSelectedAccounts,
    setSelectedProperties,
    setDatePreset,
    setCustomDateRange,
    handleDateChange,
    updateScope,
    buildRefreshBody,
  };
}

export type AppScopeContextType = ReturnType<typeof useAppScopeInternal>;

const AppScopeContext = createContext<AppScopeContextType | null>(null);

export function AppScopeProvider({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const value = useAppScopeInternal(userId);
  return <AppScopeContext.Provider value={value}>{children}</AppScopeContext.Provider>;
}

export function useAppScope(): AppScopeContextType {
  const ctx = useContext(AppScopeContext);
  if (!ctx) {
    throw new Error("useAppScope must be used within AppScopeProvider");
  }
  return ctx;
}
