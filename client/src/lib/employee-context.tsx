import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/** 部門：決定「看數據的維度」（卡片長相） */
export type Department = "ADMIN" | "AD" | "MARKETING" | "DESIGN";

export interface Employee {
  id: string;
  name: string;
  department: Department;
  assignedProducts: string[];
  assignedAccounts: string[];
}

const DEPT_LABELS: Record<Department, string> = {
  ADMIN: "管理員",
  AD: "廣告部",
  MARKETING: "行銷部",
  DESIGN: "設計部",
};

/** 內建 4 個模擬情境供測試 */
export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "boss",
    name: "總監 Boss",
    department: "ADMIN",
    assignedProducts: [],
    assignedAccounts: [],
  },
  {
    id: "ad-jay",
    name: "投手 阿傑",
    department: "AD",
    assignedProducts: [],
    assignedAccounts: ["act_123", "act_456"],
  },
  {
    id: "mkt-alice",
    name: "企劃 愛麗絲",
    department: "MARKETING",
    assignedProducts: ["小淨靈", "香水"],
    assignedAccounts: [],
  },
  {
    id: "design-flora",
    name: "美編 小花",
    department: "DESIGN",
    assignedProducts: ["奇蹟雪泡"],
    assignedAccounts: [],
  },
];

const STORAGE_KEY_CURRENT = "current-employee-id";
const STORAGE_KEY_TEAM = "team-employees";

function loadTeamFromStorage(): Employee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM);
    if (!raw) return MOCK_EMPLOYEES;
    const parsed = JSON.parse(raw) as Employee[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (_) {}
  return MOCK_EMPLOYEES;
}

function saveTeamToStorage(list: Employee[]) {
  try {
    localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(list));
  } catch (_) {}
}

function loadStoredId(): string | null {
  try {
    const id = localStorage.getItem(STORAGE_KEY_CURRENT);
    const team = loadTeamFromStorage();
    if (id && team.some((e) => e.id === id)) return id;
  } catch (_) {}
  return null;
}

function saveStoredId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT, id);
  } catch (_) {}
}

interface EmployeeContextType {
  /** 當前模擬登入者 */
  employee: Employee;
  /** 全體員工名單（供下拉與團隊頁使用） */
  employees: Employee[];
  setEmployee: (emp: Employee) => void;
  setEmployeeById: (id: string) => void;
  updateEmployee: (id: string, patch: Partial<Omit<Employee, "id">>) => void;
  /** 供 API：有 assignedAccounts 時只撈這些帳號；空則不依帳號過濾 */
  scopeAccountIds: string[] | undefined;
  /** 供 API：有 assignedProducts 時只撈這些商品；ADMIN 空 = 全部 */
  scopeProducts: string[] | undefined;
  isAdmin: boolean;
}

const EmployeeContext = createContext<EmployeeContextType | null>(null);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployeesState] = useState<Employee[]>(loadTeamFromStorage);
  const [employee, setEmployeeState] = useState<Employee>(() => {
    const storedId = loadStoredId();
    const team = loadTeamFromStorage();
    const found = team.find((e) => e.id === storedId);
    return found ?? team[0]!;
  });

  const setEmployee = useCallback((next: Employee) => {
    setEmployeeState(next);
    saveStoredId(next.id);
  }, []);

  const setEmployeeById = useCallback((id: string) => {
    const found = employees.find((e) => e.id === id);
    if (found) setEmployee(found);
  }, [employees, setEmployee]);

  const updateEmployee = useCallback((id: string, patch: Partial<Omit<Employee, "id">>) => {
    setEmployeesState((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
      saveTeamToStorage(next);
      return next;
    });
    setEmployeeState((cur) => (cur.id === id ? { ...cur, ...patch } : cur));
  }, []);

  const scopeAccountIds =
    employee.department === "ADMIN" || employee.assignedAccounts.length === 0
      ? undefined
      : employee.assignedAccounts;
  const scopeProducts =
    employee.department === "ADMIN" && employee.assignedProducts.length === 0
      ? undefined
      : employee.assignedProducts.length > 0
        ? employee.assignedProducts
        : undefined;
  const isAdmin = employee.department === "ADMIN";

  return (
    <EmployeeContext.Provider
      value={{
        employee,
        employees,
        setEmployee,
        setEmployeeById,
        updateEmployee,
        scopeAccountIds,
        scopeProducts,
        isAdmin,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployee must be used within EmployeeProvider");
  return ctx;
}

export function getDepartmentLabel(d: Department): string {
  return DEPT_LABELS[d] ?? d;
}
