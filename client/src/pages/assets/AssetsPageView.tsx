import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatDate } from "./assets-media-helpers";
import { AssetsRightPanel } from "./AssetsRightPanel";
import { AssetsVersionDialog } from "./AssetsVersionDialog";
import { AssetsPageDialogs } from "./AssetsPageDialogs";
import type { AssetsWorkbench } from "./useAssetsWorkbench";

export function AssetsPageView({ wb }: { wb: AssetsWorkbench }) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="font-semibold">素材中心</h1>
      </header>
      <div className="flex-1 overflow-hidden flex">
        <div className="w-[380px] shrink-0 border-r flex flex-col overflow-hidden">
          <div className="p-2 border-b flex gap-2">
            <Button size="sm" onClick={wb.openCreatePackage} className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              新增素材包
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {wb.packagesLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">載入中...</div>
            )}
            {wb.packagesError && (
              <div className="py-8 text-center text-sm text-destructive">載入失敗，請重新整理或重新登入</div>
            )}
            {!wb.packagesLoading && !wb.packagesError && wb.packages.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">尚無素材包，請點「新增素材包」</div>
            )}
            {!wb.packagesLoading && !wb.packagesError && wb.packages.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-1 pb-1 sticky top-0 bg-background z-10">
                  共 {wb.packages.length} 個素材包
                </p>
                {wb.packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      wb.selectedPackageId === pkg.id && !wb.createPackageMode
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => wb.openPackage(pkg)}
                  >
                    <div className="font-medium truncate">{pkg.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{pkg.brandProductName || "—"}</div>
                    {wb.selectedPackageId === pkg.id && (
                      <div className="text-xs text-muted-foreground mt-1">{wb.versions.length} 個版本</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">更新：{formatDate(pkg.updatedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl">
            <AssetsRightPanel wb={wb} />
          </div>
        </div>
      </div>
      <AssetsVersionDialog wb={wb} />
      <AssetsPageDialogs wb={wb} />
    </div>
  );
}
