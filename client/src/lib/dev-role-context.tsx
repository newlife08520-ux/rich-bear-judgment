import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { WorkRole } from "@shared/schema";

export interface DevRoleIdentity {
  workRole: WorkRole;
  assignedProductNames: string[];
  displayName: string;
}

const DEV_IDENTITIES: DevRoleIdentity[] = [
  { workRole: "ADMIN", assignedProductNames: [], displayName: "總監（管理員）" },
  { workRole: "MEDIA_BUYER", assignedProductNames: ["小淨靈", "奇蹟雪泡"], displayName: "廣告投手" },
  { workRole: "MARKETER", assignedProductNames: ["極淨晶露", "香水"], displayName: "行銷企劃" },
  { workRole: "DESIGNER", assignedProductNames: ["小淨靈", "香水"], displayName: "設計美編" },
];

const STORAGE_KEY = "dev-role-identity";

function loadStored(): DevRoleIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevRoleIdentity;
    if (parsed?.workRole && DEV_IDENTITIES.some((i) => i.workRole === parsed.workRole)) {
      return parsed;
    }
  } catch (_) {}
  return null;
}

function saveStored(identity: DevRoleIdentity) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch (_) {}
}

interface DevRoleContextType {
  /** 當前測試身份（Dev Only）；未選時預設 ADMIN 看全部 */
  identity: DevRoleIdentity;
  setIdentity: (identity: DevRoleIdentity) => void;
  /** 供 API 使用：ADMIN 且空陣列 = 不過濾；否則傳負責商品 */
  scopeProducts: string[] | undefined;
  /** 是否為 ADMIN（看全部） */
  isAdminScope: boolean;
}

const DevRoleContext = createContext<DevRoleContextType | null>(null);

export function DevRoleProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentityState] = useState<DevRoleIdentity>(() => loadStored() ?? DEV_IDENTITIES[0]!);

  const setIdentity = useCallback((next: DevRoleIdentity) => {
    setIdentityState(next);
    saveStored(next);
  }, []);

  const scopeProducts =
    identity.workRole === "ADMIN" && identity.assignedProductNames.length === 0
      ? undefined
      : identity.assignedProductNames;
  const isAdminScope = identity.workRole === "ADMIN" && identity.assignedProductNames.length === 0;

  return (
    <DevRoleContext.Provider
      value={{
        identity,
        setIdentity,
        scopeProducts,
        isAdminScope: !!scopeProducts === false,
      }}
    >
      {children}
    </DevRoleContext.Provider>
  );
}

export function useDevRole() {
  const ctx = useContext(DevRoleContext);
  if (!ctx) throw new Error("useDevRole must be used within DevRoleProvider");
  return ctx;
}

export { DEV_IDENTITIES };
