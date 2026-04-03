import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import type { AssetsWorkbench } from "./useAssetsWorkbench";

export function AssetsPageDialogs({ wb }: { wb: AssetsWorkbench }) {
  return (
    <>
      <Dialog
        open={!!wb.editingGroupId}
        onOpenChange={(open) => !open && (wb.setEditingGroupId(null), wb.setEditingGroupName(""))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>編輯主素材組名稱</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>名稱</Label>
            <Input
              value={wb.editingGroupName}
              onChange={(e) => wb.setEditingGroupName(e.target.value)}
              placeholder="例如 A版"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), wb.saveGroupEdit())}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                wb.setEditingGroupId(null);
                wb.setEditingGroupName("");
              }}
              disabled={wb.groupSaving}
            >
              取消
            </Button>
            <Button onClick={wb.saveGroupEdit} disabled={wb.groupSaving || !wb.editingGroupName.trim()}>
              {wb.groupSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!wb.deletePackageTarget} onOpenChange={(open) => !open && wb.setDeletePackageTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除素材包</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{wb.deletePackageTarget?.name}」嗎？底下的所有素材版本也會一併刪除，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wb.packageDeleting}>取消</AlertDialogCancel>
            <Button variant="destructive" onClick={wb.deletePackage} disabled={wb.packageDeleting}>
              {wb.packageDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              刪除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!wb.deleteVersionTarget} onOpenChange={(open) => !open && wb.setDeleteVersionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除版本</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此素材版本「{wb.deleteVersionTarget?.fileName}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wb.versionDeleting}>取消</AlertDialogCancel>
            <Button variant="destructive" onClick={wb.deleteVersion} disabled={wb.versionDeleting}>
              {wb.versionDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              刪除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!wb.deleteGroupTarget} onOpenChange={(open) => !open && wb.setDeleteGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除主素材組</AlertDialogTitle>
            <AlertDialogDescription>
              {wb.deleteGroupTarget && wb.versions.some((v) => v.groupId === wb.deleteGroupTarget!.id)
                ? "此主素材組底下仍有版本，請先將版本改為未分組或移到其他組後再刪除。"
                : `確定要刪除主素材組「${wb.deleteGroupTarget?.name}」嗎？此操作無法復原。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wb.groupDeleting}>取消</AlertDialogCancel>
            {wb.deleteGroupTarget &&
            wb.versions.some((v) => v.groupId === wb.deleteGroupTarget!.id) ? (
              <Button onClick={() => wb.setDeleteGroupTarget(null)}>關閉</Button>
            ) : (
              <Button variant="destructive" onClick={wb.deleteGroup} disabled={wb.groupDeleting}>
                {wb.groupDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                刪除
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
