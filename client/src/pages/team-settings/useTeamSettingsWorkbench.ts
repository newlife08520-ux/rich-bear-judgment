import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmployee, type Department } from "@/lib/employee-context";
import { useToast } from "@/hooks/use-toast";
import type { SyncedAccount, CoverageCheckData } from "./team-types";

export function useTeamSettingsWorkbench() {
  const { employees, employee, updateEmployee } = useEmployee();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(employee?.id ?? null);
  const [draftAccounts, setDraftAccounts] = useState<string[]>([]);
  const [draftProducts, setDraftProducts] = useState<string[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [manualProduct, setManualProduct] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);

  const { data: syncedData } = useQuery<{ accounts: SyncedAccount[] }>({ queryKey: ["/api/accounts/synced"] });
  const { data: productData } = useQuery<{ productNames: string[] }>({ queryKey: ["/api/dashboard/product-names"] });
  const { data: coverageData } = useQuery<CoverageCheckData>({
    queryKey: ["/api/workbench/coverage-check"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/coverage-check", { credentials: "include" });
      if (!res.ok) return { productsWithSpend: [], missingPrimary: [], missingBackup: [], overload: [] };
      return res.json();
    },
  });

  const accounts = syncedData?.accounts?.filter((a) => a.platform === "meta") ?? [];
  const productNamesFromApi = productData?.productNames ?? [];
  const selected = employees.find((e) => e.id === selectedId) ?? employees[0] ?? null;

  const allProductOptions = selected
    ? [...new Set([...productNamesFromApi, ...draftProducts])].sort((a, b) => a.localeCompare(b))
    : [];
  const accountIdToName = new Map(accounts.map((a) => [a.accountId, a.accountName || a.accountId]));

  useEffect(() => {
    if (selectedId && !employees.find((e) => e.id === selectedId)) setSelectedId(employees[0]?.id ?? null);
  }, [employees, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraftAccounts(selected.assignedAccounts);
      setDraftProducts(selected.assignedProducts);
    }
  }, [selected?.id]);

  const dirty =
    !!selected &&
    (draftAccounts.length !== selected.assignedAccounts.length ||
      draftProducts.length !== selected.assignedProducts.length ||
      draftAccounts.some((id) => !selected.assignedAccounts.includes(id)) ||
      draftProducts.some((p) => !selected.assignedProducts.includes(p)));

  const handleDepartmentChange = (value: Department) => {
    if (!selected) return;
    updateEmployee(selected.id, { department: value });
    toast({ title: "已儲存部門", duration: 2000 });
  };

  const accountLeft = accounts.map((a) => a.accountId).filter((id) => !draftAccounts.includes(id));
  const productLeft = allProductOptions.filter((p) => !draftProducts.includes(p));

  const handleMoveAccountsToRight = (ids: string[]) => {
    setDraftAccounts((prev) => [...prev, ...ids]);
  };
  const handleMoveAccountsToLeft = (ids: string[]) => {
    setDraftAccounts((prev) => prev.filter((id) => !ids.includes(id)));
  };
  const handleMoveProductsToRight = (ids: string[]) => {
    setDraftProducts((prev) => [...new Set([...prev, ...ids])]);
  };
  const handleMoveProductsToLeft = (ids: string[]) => {
    setDraftProducts((prev) => prev.filter((p) => !ids.includes(p)));
  };

  const handleAddManualProduct = () => {
    const v = manualProduct.trim();
    if (!v || draftProducts.includes(v)) return;
    setDraftProducts((prev) => [...prev, v].sort((a, b) => a.localeCompare(b)));
    setManualProduct("");
  };

  const handleSave = () => {
    if (!selected || !dirty) return;
    setDiffOpen(true);
  };

  const confirmSave = () => {
    if (!selected) return;
    updateEmployee(selected.id, { assignedAccounts: draftAccounts, assignedProducts: draftProducts });
    setDiffOpen(false);
    toast({ title: "已儲存", duration: 2000 });
  };

  const handleUndo = () => {
    if (selected) {
      setDraftAccounts(selected.assignedAccounts);
      setDraftProducts(selected.assignedProducts);
      toast({ title: "已復原為上次儲存內容", duration: 2000 });
    }
  };

  return {
    employees,
    selectedId,
    setSelectedId,
    selected,
    draftAccounts,
    draftProducts,
    accountSearch,
    setAccountSearch,
    productSearch,
    setProductSearch,
    manualProduct,
    setManualProduct,
    diffOpen,
    setDiffOpen,
    coverageData,
    accounts,
    accountLeft,
    productLeft,
    accountIdToName,
    dirty,
    handleDepartmentChange,
    handleMoveAccountsToRight,
    handleMoveAccountsToLeft,
    handleMoveProductsToRight,
    handleMoveProductsToLeft,
    handleAddManualProduct,
    handleSave,
    confirmSave,
    handleUndo,
  };
}

export type TeamSettingsWorkbench = ReturnType<typeof useTeamSettingsWorkbench>;
