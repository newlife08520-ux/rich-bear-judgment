/**
 * 團隊權限：防漏三件套 — 雙欄 Transfer List、Coverage guardrail、儲存前 diff + undo
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEmployee, getDepartmentLabel, type Department } from "@/lib/employee-context";
import { useToast } from "@/hooks/use-toast";
import { Users, ChevronRight, ChevronLeft, Save, Undo2 } from "lucide-react";

type SyncedAccount = { id: string; accountId: string; accountName?: string; platform: string };

function TransferList({
  leftItems,
  rightItems,
  rightSet,
  onMoveToRight,
  onMoveToLeft,
  getLabel,
  leftTitle,
  rightTitle,
  search,
  onSearchChange,
}: {
  leftItems: string[];
  rightItems: string[];
  rightSet: Set<string>;
  onMoveToRight: (ids: string[]) => void;
  onMoveToLeft: (ids: string[]) => void;
  getLabel: (id: string) => string;
  leftTitle: string;
  rightTitle: string;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const [leftSel, setLeftSel] = useState<Set<string>>(new Set());
  const [rightSel, setRightSel] = useState<Set<string>>(new Set());
  const [showOnlyRight, setShowOnlyRight] = useState(false);
  const filteredLeft = search.trim()
    ? leftItems.filter((id) => getLabel(id).toLowerCase().includes(search.trim().toLowerCase()))
    : leftItems;
  const filteredRight = search.trim()
    ? rightItems.filter((id) => getLabel(id).toLowerCase().includes(search.trim().toLowerCase()))
    : rightItems;
  const displayRight = showOnlyRight ? filteredRight.filter((id) => rightSel.has(id)) : filteredRight;
  const hasSearch = search.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="🔍 搜尋" value={search} onChange={(e) => onSearchChange(e.target.value)} className="max-w-xs" />
        {hasSearch && (
          <span className="text-xs text-muted-foreground">搜尋結果：左 {filteredLeft.length} 筆、右 {filteredRight.length} 筆</span>
        )}
      </div>
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 rounded-md border flex flex-col min-h-[200px]">
          <div className="px-2 py-1 border-b flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{leftTitle}（{filteredLeft.length}）</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => { setLeftSel(new Set(filteredLeft)); }}
              disabled={filteredLeft.length === 0}
            >
              全選目前篩選
            </Button>
          </div>
          <ul className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {filteredLeft.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setLeftSel((s) => (s.has(id) ? (() => { const n = new Set(s); n.delete(id); return n; })() : new Set(s).add(id)))}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm truncate block ${leftSel.has(id) ? "bg-primary/20" : "hover:bg-muted"}`}
                >
                  {getLabel(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => { const ids = [...leftSel]; onMoveToRight(ids); setLeftSel(new Set()); setRightSel(new Set()); }}
            disabled={leftSel.size === 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => { const ids = [...rightSel]; onMoveToLeft(ids); setLeftSel(new Set()); setRightSel(new Set()); }}
            disabled={rightSel.size === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 rounded-md border flex flex-col min-h-[200px]">
          <div className="px-2 py-1 border-b flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{rightTitle}（{displayRight.length}）</span>
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showOnlyRight} onChange={(e) => setShowOnlyRight(e.target.checked)} className="rounded" />
              只看已選
            </label>
          </div>
          <ul className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {displayRight.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setRightSel((s) => (s.has(id) ? (() => { const n = new Set(s); n.delete(id); return n; })() : new Set(s).add(id)))}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm truncate block ${rightSel.has(id) ? "bg-primary/20" : "hover:bg-muted"}`}
                >
                  {getLabel(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TeamSettingsPage() {
  const { employees, employee, setEmployeeById, updateEmployee } = useEmployee();
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
  const { data: coverageData } = useQuery<{
    productsWithSpend: string[];
    missingPrimary: string[];
    missingBackup: string[];
    overload: Array<{ userId: string; asPrimaryCount: number; limit: number }>;
  }>({
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
    selected &&
    (draftAccounts.length !== selected.assignedAccounts.length ||
      draftProducts.length !== selected.assignedProducts.length ||
      draftAccounts.some((id) => !selected.assignedAccounts.includes(id)) ||
      draftProducts.some((p) => !selected.assignedProducts.includes(p)));

  const assignedAccountSet = new Set(employees.flatMap((e) => (e.id === selected?.id ? draftAccounts : e.assignedAccounts)));
  const uncoveredAccounts = accounts.filter((a) => !assignedAccountSet.has(a.accountId)).map((a) => a.accountName || a.accountId);
  const noCoverage = selected && draftAccounts.length === 0 && draftProducts.length === 0;

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

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <h1 className="font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          團隊權限
        </h1>
      </header>
      <div className="flex-1 overflow-hidden flex">
        <div className="w-64 border-r p-3 flex flex-col gap-1 overflow-y-auto">
          <Label className="text-xs text-muted-foreground px-2">員工列表</Label>
          {employees.map((emp) => (
            <Button
              key={emp.id}
              variant={selectedId === emp.id ? "secondary" : "ghost"}
              size="sm"
              className="justify-start"
              onClick={() => setSelectedId(emp.id)}
            >
              {emp.name}
            </Button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {selected ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className={coverageData?.missingPrimary?.length ? "border-amber-200 dark:border-amber-800" : ""}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">缺 primary owner 的在投商品</CardTitle>
                    <p className="text-2xl font-semibold text-muted-foreground">{(coverageData?.missingPrimary?.length) ?? 0}</p>
                  </CardHeader>
                  <CardContent className="py-0 px-4 pb-3">
                    <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
                      {(coverageData?.missingPrimary ?? []).slice(0, 3).map((p) => (
                        <li key={p} className="truncate">{p}</li>
                      ))}
                      {(coverageData?.missingPrimary?.length ?? 0) > 3 && (
                        <li>…共 {(coverageData?.missingPrimary?.length) ?? 0} 筆</li>
                      )}
                    </ul>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}>
                      立即處理
                    </Button>
                  </CardContent>
                </Card>
                <Card className={coverageData?.missingBackup?.length ? "border-amber-200 dark:border-amber-800" : ""}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">缺 backup owner 的在投商品</CardTitle>
                    <p className="text-2xl font-semibold text-muted-foreground">{(coverageData?.missingBackup?.length) ?? 0}</p>
                  </CardHeader>
                  <CardContent className="py-0 px-4 pb-3">
                    <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
                      {(coverageData?.missingBackup ?? []).slice(0, 3).map((p) => (
                        <li key={p} className="truncate">{p}</li>
                      ))}
                      {(coverageData?.missingBackup?.length ?? 0) > 3 && (
                        <li>…共 {(coverageData?.missingBackup?.length) ?? 0} 筆</li>
                      )}
                    </ul>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}>
                      立即處理
                    </Button>
                  </CardContent>
                </Card>
                <Card className={coverageData?.overload?.length ? "border-amber-200 dark:border-amber-800" : ""}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">主責超載的人</CardTitle>
                    <p className="text-2xl font-semibold text-muted-foreground">{(coverageData?.overload?.length) ?? 0}</p>
                  </CardHeader>
                  <CardContent className="py-0 px-4 pb-3">
                    <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
                      {(coverageData?.overload ?? []).slice(0, 3).map((o) => {
                        const name = employees.find((e) => e.id === o.userId)?.name || o.userId;
                        return (
                          <li key={o.userId}>{name}（primary × {o.asPrimaryCount}）</li>
                        );
                      })}
                      {(coverageData?.overload?.length ?? 0) > 3 && (
                        <li>…共 {(coverageData?.overload?.length) ?? 0} 筆</li>
                      )}
                    </ul>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}>
                      立即處理
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>{selected.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">所屬部門與負責範圍（儲存前可復原）</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>所屬部門</Label>
                    <Select value={selected.department} onValueChange={(v) => handleDepartmentChange(v as Department)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">{getDepartmentLabel("ADMIN")}</SelectItem>
                        <SelectItem value="AD">{getDepartmentLabel("AD")}</SelectItem>
                        <SelectItem value="MARKETING">{getDepartmentLabel("MARKETING")}</SelectItem>
                        <SelectItem value="DESIGN">{getDepartmentLabel("DESIGN")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>負責的廣告帳號（雙欄選取）</Label>
                    {accounts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">尚無同步的廣告帳號，請至設定中心同步</p>
                    ) : (
                      <TransferList
                        leftItems={accountLeft}
                        rightItems={draftAccounts}
                        rightSet={new Set(draftAccounts)}
                        onMoveToRight={handleMoveAccountsToRight}
                        onMoveToLeft={handleMoveAccountsToLeft}
                        getLabel={(id) => accountIdToName.get(id) || id}
                        leftTitle="未選"
                        rightTitle="已選"
                        search={accountSearch}
                        onSearchChange={setAccountSearch}
                      />
                    )}
                  </div>
                  <div className="space-y-2" id="products-section">
                    <Label>負責的商品（雙欄選取）</Label>
                    <TransferList
                      leftItems={productLeft}
                      rightItems={draftProducts}
                      rightSet={new Set(draftProducts)}
                      onMoveToRight={handleMoveProductsToRight}
                      onMoveToLeft={handleMoveProductsToLeft}
                      getLabel={(p) => p}
                      leftTitle="未選"
                      rightTitle="已選"
                      search={productSearch}
                      onSearchChange={setProductSearch}
                    />
                    <Input
                      placeholder="+ 手動輸入商品名，Enter 加入"
                      value={manualProduct}
                      onChange={(e) => setManualProduct(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddManualProduct(); } }}
                      className="max-w-md"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={!dirty} className="gap-1">
                      <Save className="w-4 h-4" />
                      儲存
                    </Button>
                    <Button variant="outline" onClick={handleUndo} disabled={!dirty} className="gap-1">
                      <Undo2 className="w-4 h-4" />
                      復原
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground">請從左側選擇一位員工</p>
          )}
        </div>
      </div>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>確認變更</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">儲存前（目前）</p>
                  <p>帳號：{selected.assignedAccounts.length} 個 · 商品：{selected.assignedProducts.length} 個</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">儲存後</p>
                  <p>帳號：{draftAccounts.length} 個 · 商品：{draftProducts.length} 個</p>
                </div>
              </div>
              {(() => {
                const addedAccounts = draftAccounts.filter((id) => !selected!.assignedAccounts.includes(id));
                const removedAccounts = selected!.assignedAccounts.filter((id) => !draftAccounts.includes(id));
                const addedProducts = draftProducts.filter((p) => !selected!.assignedProducts.includes(p));
                const removedProducts = selected!.assignedProducts.filter((p) => !draftProducts.includes(p));
                const hasDiff = addedAccounts.length + removedAccounts.length + addedProducts.length + removedProducts.length > 0;
                if (!hasDiff) return null;
                return (
                  <div className="border rounded-lg p-3 space-y-3">
                    <p className="font-medium text-muted-foreground">變更明細</p>
                    {addedAccounts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">帳號 · 新增（{addedAccounts.length}）</p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside">{addedAccounts.slice(0, 10).map((id) => <li key={id}>{accountIdToName.get(id) || id}</li>)}{addedAccounts.length > 10 && <li>…共 {addedAccounts.length} 筆</li>}</ul>
                      </div>
                    )}
                    {removedAccounts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">帳號 · 移除（{removedAccounts.length}）</p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside">{removedAccounts.slice(0, 10).map((id) => <li key={id}>{accountIdToName.get(id) || id}</li>)}{removedAccounts.length > 10 && <li>…共 {removedAccounts.length} 筆</li>}</ul>
                      </div>
                    )}
                    {addedProducts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">商品 · 新增（{addedProducts.length}）</p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside">{addedProducts.slice(0, 10).map((p) => <li key={p}>{p}</li>)}{addedProducts.length > 10 && <li>…共 {addedProducts.length} 筆</li>}</ul>
                      </div>
                    )}
                    {removedProducts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">商品 · 移除（{removedProducts.length}）</p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside">{removedProducts.slice(0, 10).map((p) => <li key={p}>{p}</li>)}{removedProducts.length > 10 && <li>…共 {removedProducts.length} 筆</li>}</ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiffOpen(false)}>取消</Button>
            <Button onClick={confirmSave}>確認儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
