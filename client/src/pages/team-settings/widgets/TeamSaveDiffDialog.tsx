import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee } from "@/lib/employee-context";

export function TeamSaveDiffDialog({
  open,
  onOpenChange,
  selected,
  draftAccounts,
  draftProducts,
  accountIdToName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: Employee | null;
  draftAccounts: string[];
  draftProducts: string[];
  accountIdToName: Map<string, string>;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              const addedAccounts = draftAccounts.filter((id) => !selected.assignedAccounts.includes(id));
              const removedAccounts = selected.assignedAccounts.filter((id) => !draftAccounts.includes(id));
              const addedProducts = draftProducts.filter((p) => !selected.assignedProducts.includes(p));
              const removedProducts = selected.assignedProducts.filter((p) => !draftProducts.includes(p));
              const hasDiff = addedAccounts.length + removedAccounts.length + addedProducts.length + removedProducts.length > 0;
              if (!hasDiff) return null;
              return (
                <div className="border rounded-lg p-3 space-y-3">
                  <p className="font-medium text-muted-foreground">變更明細</p>
                  {addedAccounts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-[var(--status-profit)] mb-0.5">帳號 · 新增（{addedAccounts.length}）</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">{addedAccounts.slice(0, 10).map((id) => <li key={id}>{accountIdToName.get(id) || id}</li>)}{addedAccounts.length > 10 && <li>…共 {addedAccounts.length} 筆</li>}</ul>
                    </div>
                  )}
                  {removedAccounts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-0.5">帳號 · 移除（{removedAccounts.length}）</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">{removedAccounts.slice(0, 10).map((id) => <li key={id}>{accountIdToName.get(id) || id}</li>)}{removedAccounts.length > 10 && <li>…共 {removedAccounts.length} 筆</li>}</ul>
                    </div>
                  )}
                  {addedProducts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-[var(--status-profit)] mb-0.5">商品 · 新增（{addedProducts.length}）</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">{addedProducts.slice(0, 10).map((p) => <li key={p}>{p}</li>)}{addedProducts.length > 10 && <li>…共 {addedProducts.length} 筆</li>}</ul>
                    </div>
                  )}
                  {removedProducts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-0.5">商品 · 移除（{removedProducts.length}）</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">{removedProducts.slice(0, 10).map((p) => <li key={p}>{p}</li>)}{removedProducts.length > 10 && <li>…共 {removedProducts.length} 筆</li>}</ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onConfirm}>確認儲存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
