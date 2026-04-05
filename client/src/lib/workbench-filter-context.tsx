import { createContext, useContext, useState, useCallback } from "react";
import type { SavedViewId } from "./decision-workbench";

export type SortKey =
  | "spend"
  | "revenue"
  | "roas"
  | "ctr"
  | "cvr"
  | "priority"
  | "updated"
  | "dormant_priority"
  /** 與 dormant_priority 同權重（revivalPriorityScore）；別名供文件／verify 對齊 */
  | "revival_priority";

/** 清單 Pareto／優先級視角：與 CI /api/pareto/by-product 的 product id（商品名）對齊 */
export type ParetoListMode = "all" | "needs_attention" | "pareto_marked";

export interface WorkbenchFilterState {
  savedViewId: SavedViewId | "";
  productIds: string[];
  ownerIds: string[];
  statusFilter: string[];
  priorityFilter: string[];
  minSpend: number;
  sortBy: SortKey;
  sortDesc: boolean;
  /** 預設「重點 Top 20%」：對齊 80／20；無標記時後備為需處理視角（見各頁 workbench） */
  paretoListMode: ParetoListMode;
}

const STORAGE_KEY = "workbench-filter";

const defaultState: WorkbenchFilterState = {
  savedViewId: "",
  productIds: [],
  ownerIds: [],
  statusFilter: [],
  priorityFilter: [],
  minSpend: 0,
  sortBy: "dormant_priority",
  sortDesc: true,
  paretoListMode: "pareto_marked",
};

function load(): WorkbenchFilterState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      return { ...defaultState, ...parsed };
    }
  } catch {}
  return defaultState;
}

function save(s: WorkbenchFilterState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

const WorkbenchFilterContext = createContext<{
  filter: WorkbenchFilterState;
  setSavedView: (id: SavedViewId | "") => void;
  setProductFilter: (ids: string[]) => void;
  setOwnerFilter: (ids: string[]) => void;
  setStatusFilter: (statuses: string[]) => void;
  setPriorityFilter: (priorities: string[]) => void;
  setMinSpend: (v: number) => void;
  setSort: (by: SortKey, desc?: boolean) => void;
  setParetoListMode: (mode: ParetoListMode) => void;
  resetFilter: () => void;
} | null>(null);

export function WorkbenchFilterProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<WorkbenchFilterState>(load);

  const persist = useCallback((next: WorkbenchFilterState) => {
    setFilter(next);
    save(next);
  }, []);

  const setSavedView = useCallback(
    (savedViewId: SavedViewId | "") => {
      persist({ ...filter, savedViewId });
    },
    [filter, persist]
  );

  const setProductFilter = useCallback(
    (productIds: string[]) => {
      persist({ ...filter, productIds });
    },
    [filter, persist]
  );

  const setOwnerFilter = useCallback(
    (ownerIds: string[]) => {
      persist({ ...filter, ownerIds });
    },
    [filter, persist]
  );

  const setStatusFilter = useCallback(
    (statusFilter: string[]) => {
      persist({ ...filter, statusFilter });
    },
    [filter, persist]
  );

  const setPriorityFilter = useCallback(
    (priorityFilter: string[]) => {
      persist({ ...filter, priorityFilter });
    },
    [filter, persist]
  );

  const setMinSpend = useCallback(
    (minSpend: number) => {
      persist({ ...filter, minSpend });
    },
    [filter, persist]
  );

  const setSort = useCallback(
    (sortBy: SortKey, sortDesc = true) => {
      persist({ ...filter, sortBy, sortDesc });
    },
    [filter, persist]
  );

  const setParetoListMode = useCallback(
    (paretoListMode: ParetoListMode) => {
      persist({ ...filter, paretoListMode });
    },
    [filter, persist]
  );

  const resetFilter = useCallback(() => {
    persist(defaultState);
  }, [persist]);

  return (
    <WorkbenchFilterContext.Provider
      value={{
        filter,
        setSavedView,
        setProductFilter,
        setOwnerFilter,
        setStatusFilter,
        setPriorityFilter,
        setMinSpend,
        setSort,
        setParetoListMode,
        resetFilter,
      }}
    >
      {children}
    </WorkbenchFilterContext.Provider>
  );
}

export function useWorkbenchFilter() {
  const ctx = useContext(WorkbenchFilterContext);
  if (!ctx) throw new Error("useWorkbenchFilter must be used within WorkbenchFilterProvider");
  return ctx;
}
