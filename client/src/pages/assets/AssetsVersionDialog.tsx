import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { assetTypes, assetTypeLabels, assetAspectRatios, assetAspectRatioLabels, type AssetType, type AssetAspectRatio } from "@shared/schema";
import type { AssetsWorkbench } from "./useAssetsWorkbench";

export function AssetsVersionDialog({ wb }: { wb: AssetsWorkbench }) {
  return (
    <Dialog open={wb.versionDialogOpen} onOpenChange={wb.setVersionDialogOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{wb.editingVersionId ? "編輯素材版本" : "新增素材版本"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {wb.versionSubmitError && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {wb.versionSubmitError}
              {wb.versionSubmitErrors != null &&
                typeof wb.versionSubmitErrors === "object" &&
                "fieldErrors" in (wb.versionSubmitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">
                    {JSON.stringify((wb.versionSubmitErrors as { fieldErrors?: unknown }).fieldErrors, null, 2)}
                  </pre>
                )}
            </div>
          )}

          <div className="space-y-2">
            <Label>素材檔案</Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="version-file-upload"
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={wb.handleVersionFileUpload}
                  disabled={wb.versionUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={wb.versionUploading || !wb.selectedPackageId}
                  onClick={() => document.getElementById("version-file-upload")?.click()}
                >
                  {wb.versionUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  選擇檔案上傳
                </Button>
                <span className="text-xs text-muted-foreground">上傳後自動帶入檔名、URL、類型</span>
              </div>
              {wb.versionUploadError && <p className="text-sm text-destructive">{wb.versionUploadError}</p>}
              <p className="text-xs text-muted-foreground">或貼上 URL（備用）</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>檔案 URL *</Label>
            <Input
              value={wb.versionForm.fileUrl}
              onChange={(e) => wb.setVersionForm((f) => ({ ...f, fileUrl: e.target.value }))}
              placeholder="上傳後自動帶入，或手動貼上"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>檔名 *</Label>
              <Input
                value={wb.versionForm.fileName}
                onChange={(e) => wb.setVersionForm((f) => ({ ...f, fileName: e.target.value }))}
                placeholder="上傳後自動帶入"
              />
            </div>
            <div className="space-y-2">
              <Label>檔案類型 (MIME)</Label>
              <Input
                value={wb.versionForm.fileType}
                onChange={(e) => wb.setVersionForm((f) => ({ ...f, fileType: e.target.value }))}
                placeholder="例如 image/png、video/mp4"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <Label className="text-muted-foreground">類型與比例</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>類型</Label>
                <Select
                  value={wb.versionForm.assetType}
                  onValueChange={(v) => wb.setVersionForm((f) => ({ ...f, assetType: v as AssetType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((k) => (
                      <SelectItem key={k} value={k}>
                        {assetTypeLabels[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>比例</Label>
                <Select
                  value={wb.versionForm.aspectRatio}
                  onValueChange={(v) => wb.setVersionForm((f) => ({ ...f, aspectRatio: v as AssetAspectRatio }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assetAspectRatios.map((k) => (
                      <SelectItem key={k} value={k}>
                        {assetAspectRatioLabels[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {wb.pendingDetection?.detectStatus === "failed" && (
                  <p className="text-xs text-amber-600">比例待確認，請手動選擇</p>
                )}
                {wb.pendingDetection?.detectStatus === "fallback" && (
                  <p className="text-xs text-muted-foreground">比例由檔名推測，請確認</p>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>版本備註</Label>
            <Textarea
              value={wb.versionForm.versionNote}
              onChange={(e) => wb.setVersionForm((f) => ({ ...f, versionNote: e.target.value }))}
              rows={2}
              placeholder="選填"
            />
          </div>
          <div className="space-y-2">
            <Label>主素材組（A/B/C，同一支素材不同尺寸可歸同組）</Label>
            <Select
              value={wb.versionForm.groupId || "_none"}
              onValueChange={(v) => wb.setVersionForm((f) => ({ ...f, groupId: v === "_none" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="不指定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— 不指定 —</SelectItem>
                {wb.assetGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">例：A版的 9:16 / 4:5 / 1:1 可放同一組，投放時可一鍵帶入</p>
            {wb.suggestedGroupNameForForm && (
              <p className="text-xs text-muted-foreground">
                建議主素材組：<span className="font-medium text-foreground">{wb.suggestedGroupNameForForm}</span>
                （請先建立主素材組或選其他）
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="version-isPrimary"
              checked={wb.versionForm.isPrimary}
              onChange={(e) => wb.setVersionForm((f) => ({ ...f, isPrimary: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="version-isPrimary">設為主版本</Label>
          </div>
          <div className="flex items-center gap-2 rounded-md border p-2 bg-muted/30">
            <Checkbox
              id="creative-review-after-save"
              checked={wb.submitCreativeReviewAfterSave}
              onCheckedChange={(c) => wb.setSubmitCreativeReviewAfterSave(c === true)}
            />
            <Label htmlFor="creative-review-after-save" className="text-sm font-normal cursor-pointer">
              儲存後立即送審（AI 初審，需已設定 API Key；圖像素材）
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => wb.setVersionDialogOpen(false)} disabled={wb.versionSaving}>
            取消
          </Button>
          <Button onClick={wb.saveVersion} disabled={wb.versionSaving}>
            {wb.versionSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {wb.editingVersionId ? "儲存" : "建立"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
