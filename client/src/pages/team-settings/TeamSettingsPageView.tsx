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
import { getDepartmentLabel, type Department } from "@/lib/employee-context";
import { Users, Save, Undo2 } from "lucide-react";
import type { TeamSettingsWorkbench } from "./useTeamSettingsWorkbench";
import { TeamTransferList } from "./widgets/TeamTransferList";
import { TeamCoverageCards } from "./widgets/TeamCoverageCards";
import { TeamSaveDiffDialog } from "./widgets/TeamSaveDiffDialog";

export function TeamSettingsPageView({ wb }: { wb: TeamSettingsWorkbench }) {
  const {
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
  } = wb;

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
              <TeamCoverageCards coverageData={coverageData} employees={employees} />
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
                      <TeamTransferList
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
                    <TeamTransferList
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

      <TeamSaveDiffDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        selected={selected}
        draftAccounts={draftAccounts}
        draftProducts={draftProducts}
        accountIdToName={accountIdToName}
        onConfirm={confirmSave}
      />
    </div>
  );
}
