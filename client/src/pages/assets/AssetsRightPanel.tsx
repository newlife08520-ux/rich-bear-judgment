import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Star, Film } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AssetThumbnailImg, toAbsoluteUploadUrl } from "@/components/AssetThumbnailImg";
import { assetTypeLabels, assetAspectRatios, assetAspectRatioLabels } from "@shared/schema";
import { cn as _cn } from "@/lib/utils";
import { PackageFormFields } from "./PackageFormFields";
import { formatDate } from "./assets-media-helpers";
import { packageToForm } from "./asset-types-forms";
import type { AssetsWorkbench } from "./useAssetsWorkbench";
import { AssetVersionIntelligenceStrip } from "./AssetVersionIntelligenceStrip";

const cn = typeof _cn === "function" ? _cn : (...a: (string | undefined | false)[]) => a.filter(Boolean).join(" ");

const VERSION_GRID_COLS = 3;
const VERSION_ROW_HEIGHT = 130;

export function AssetsRightPanel({ wb }: { wb: AssetsWorkbench }) {
  const versionRowCount = Math.ceil(wb.filteredAndSortedVersions.length / VERSION_GRID_COLS);
  const versionVirtualizer = useVirtualizer({
    count: versionRowCount,
    getScrollElement: () => wb.versionGridScrollRef.current,
    estimateSize: () => VERSION_ROW_HEIGHT,
    overscan: 3,
  });

  if (wb.createPackageMode) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">新增素材包</h3>
          <p className="text-sm text-muted-foreground mb-4">填名稱即可建立，建立後可立刻上傳版本。</p>
          {wb.packageSubmitError && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-4">
              {wb.packageSubmitError}
              {wb.packageSubmitErrors != null &&
                typeof wb.packageSubmitErrors === "object" &&
                "fieldErrors" in (wb.packageSubmitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">
                    {JSON.stringify((wb.packageSubmitErrors as { fieldErrors?: unknown }).fieldErrors, null, 2)}
                  </pre>
                )}
            </div>
          )}
          <PackageFormFields form={wb.packageForm} setForm={wb.setPackageForm} mode="create" />
          <div className="flex gap-2 mt-4">
            <Button onClick={wb.savePackage} disabled={wb.packageSaving || !wb.packageForm.name.trim()}>
              {wb.packageSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              建立
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                wb.setCreatePackageMode(false);
                wb.setSelectedPackageId(wb.packages[0]?.id ?? null);
                if (wb.packages[0]) wb.setPackageForm(packageToForm(wb.packages[0]));
              }}
              disabled={wb.packageSaving}
            >
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!wb.selectedPackageId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          請從左側選擇素材包，或點「新增素材包」建立
        </CardContent>
      </Card>
    );
  }
  if (wb.selectedPackageLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">載入中...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-3">主素材組</h3>
          <p className="text-sm text-muted-foreground mb-3">
            建立 A版、B版 等組別，新增版本時可指定所屬組；投放中心將依組批次建草稿。
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {wb.assetGroups.map((g) => (
              <div key={g.id} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1">
                <Badge variant="secondary" className="text-sm font-normal">
                  {g.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    wb.setEditingGroupId(g.id);
                    wb.setEditingGroupName(g.name);
                  }}
                  title="編輯組名"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => wb.setDeleteGroupTarget(g)}
                  title="刪除主素材組"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="例如 A版、B版"
              value={wb.newGroupName}
              onChange={(e) => wb.setNewGroupName(e.target.value)}
              className="max-w-[180px]"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), wb.createAssetGroup())}
            />
            <Button size="sm" onClick={wb.createAssetGroup} disabled={wb.groupCreating || !wb.newGroupName.trim()}>
              {wb.groupCreating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              建立主素材組
            </Button>
          </div>
        </CardContent>
      </Card>

      <div ref={wb.versionSectionRef}>
        {wb.creativeBatchSummary && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-foreground">
              {wb.creativeBatchSummary.total} 個素材已送審，{wb.creativeBatchSummary.completed} 個完成，
              {wb.creativeBatchSummary.failed} 個失敗（可於各版本卡重試）
            </p>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={wb.dismissCreativeBatchSummary}>
              關閉
            </Button>
          </div>
        )}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">素材版本</h3>
              <Button size="sm" onClick={wb.openAddVersion}>
                <Plus className="w-4 h-4 mr-2" />
                新增版本
              </Button>
            </div>

            {wb.versions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border bg-muted/30">
                <Select value={wb.versionDateFilter} onValueChange={wb.setVersionDateFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="日期" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部日期</SelectItem>
                    <SelectItem value="today">今天</SelectItem>
                    <SelectItem value="yesterday">昨天</SelectItem>
                    <SelectItem value="last7">最近 7 天</SelectItem>
                    <SelectItem value="last30">最近 30 天</SelectItem>
                    <SelectItem value="custom">自訂區間</SelectItem>
                  </SelectContent>
                </Select>
                {wb.versionDateFilter === "custom" && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={wb.versionDateCustomStart}
                      onChange={(e) => wb.setVersionDateCustomStart(e.target.value)}
                      className="w-[130px] h-9"
                    />
                    <span className="text-muted-foreground">～</span>
                    <Input
                      type="date"
                      value={wb.versionDateCustomEnd}
                      onChange={(e) => wb.setVersionDateCustomEnd(e.target.value)}
                      className="w-[130px] h-9"
                    />
                  </div>
                )}
                <Select value={wb.versionTypeFilter} onValueChange={wb.setVersionTypeFilter}>
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue placeholder="類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="image">圖片</SelectItem>
                    <SelectItem value="video">影片</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={wb.versionRatioFilter} onValueChange={wb.setVersionRatioFilter}>
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue placeholder="比例" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {assetAspectRatios.map((k) => (
                      <SelectItem key={k} value={k}>
                        {assetAspectRatioLabels[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="關鍵字（檔名、素材包）"
                  value={wb.versionKeyword}
                  onChange={(e) => wb.setVersionKeyword(e.target.value)}
                  className="max-w-[180px] h-9"
                />
                <Select
                  value={
                    wb.versionGroupFilter === "" ||
                    wb.versionGroupFilter === "_none" ||
                    wb.assetGroups.some((g) => g.id === wb.versionGroupFilter)
                      ? wb.versionGroupFilter || "all"
                      : "all"
                  }
                  onValueChange={(v) => wb.setVersionGroupFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="主素材組" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="_none">未分組</SelectItem>
                    {wb.assetGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={wb.versionSortBy} onValueChange={(v) => wb.setVersionSortBy(v as "newest" | "name")}>
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">最新上傳</SelectItem>
                    <SelectItem value="name">名稱排序</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {wb.versions.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  checked={
                    wb.filteredAndSortedVersions.length > 0 &&
                    wb.filteredAndSortedVersions.every((v) => wb.selectedVersionIdsForBatch.has(v.id))
                  }
                  onCheckedChange={(checked) => {
                    if (checked)
                      wb.setSelectedVersionIdsForBatch(new Set(wb.filteredAndSortedVersions.map((v) => v.id)));
                    else wb.setSelectedVersionIdsForBatch(new Set());
                  }}
                />
                <span className="text-sm text-muted-foreground">全選</span>
                {wb.selectedVersionIdsForBatch.size > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => wb.setSelectedVersionIdsForBatch(new Set())}>
                      取消選取
                    </Button>
                    <Button variant="destructive" size="sm" onClick={wb.batchDeleteVersions} disabled={wb.batchDeleting}>
                      {wb.batchDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      批次刪除 ({wb.selectedVersionIdsForBatch.size})
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void wb.batchQueueCreativeReviews()}
                      disabled={wb.creativeBatchReviewing}
                    >
                      {wb.creativeBatchReviewing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      批次送審 ({wb.selectedVersionIdsForBatch.size})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => wb.toast({ title: "即將推出", description: "批次移動到另一素材包" })}
                    >
                      批次移動
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => wb.toast({ title: "即將推出", description: "批次設標籤" })}
                    >
                      批次標記
                    </Button>
                  </>
                )}
              </div>
            )}

            {wb.versionsLoading ? (
              <p className="text-sm text-muted-foreground py-4">載入中...</p>
            ) : wb.versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">尚無版本，請點「新增版本」</p>
            ) : wb.filteredAndSortedVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">篩選後無符合的版本</p>
            ) : (
              <div ref={wb.versionGridScrollRef} className="overflow-auto max-h-[60vh] rounded border">
                <div style={{ height: versionVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                  {versionVirtualizer.getVirtualItems().map((virtualRow) => {
                    const start = virtualRow.index * VERSION_GRID_COLS;
                    const rowItems = wb.filteredAndSortedVersions.slice(start, start + VERSION_GRID_COLS);
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-1 py-1"
                      >
                        {rowItems.map((v) => (
                          <Card key={v.id} className="overflow-hidden">
                            <div className="flex gap-3 p-3">
                              <div className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded border bg-muted/50 overflow-hidden">
                                {v.assetType === "video" ? (
                                  v.thumbnailUrl ? (
                                    <AssetThumbnailImg
                                      versionId={v.id}
                                      url={toAbsoluteUploadUrl(v.thumbnailUrl)}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : v.fileUrl ? (
                                    <video
                                      src={toAbsoluteUploadUrl(v.fileUrl)}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
                                      <Film className="w-8 h-8" />
                                      <span className="text-xs">影片</span>
                                    </div>
                                  )
                                ) : (
                                  <AssetThumbnailImg
                                    versionId={v.id}
                                    url={toAbsoluteUploadUrl(v.thumbnailUrl || v.fileUrl || "")}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-medium text-sm truncate" title={v.fileName}>
                                    {v.fileName}
                                  </span>
                                  <Checkbox
                                    checked={wb.selectedVersionIdsForBatch.has(v.id)}
                                    onCheckedChange={(checked) => {
                                      wb.setSelectedVersionIdsForBatch((prev) => {
                                        const next = new Set(prev);
                                        if (checked) next.add(v.id);
                                        else next.delete(v.id);
                                        return next;
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {v.groupId && wb.assetGroups.find((g) => g.id === v.groupId) && (
                                    <>
                                      <span>{wb.assetGroups.find((g) => g.id === v.groupId)!.name}</span>
                                      <span>·</span>
                                    </>
                                  )}
                                  {!v.groupId && (
                                    <>
                                      <span className="text-amber-600">未歸組</span>
                                      <span>·</span>
                                    </>
                                  )}
                                  <span>{assetTypeLabels[v.assetType]}</span>
                                  <span>·</span>
                                  <span>{assetAspectRatioLabels[v.aspectRatio]}</span>
                                  {v.detectStatus && (
                                    <Badge
                                      variant={
                                        v.detectStatus === "success"
                                          ? "default"
                                          : v.detectStatus === "manual_confirmed"
                                            ? "secondary"
                                            : "outline"
                                      }
                                      className={cn(
                                        "text-xs font-normal",
                                        v.detectStatus === "failed" && "border-amber-500/50 text-amber-700",
                                        v.detectStatus === "fallback" && "border-amber-400/50 text-amber-600"
                                      )}
                                      title={
                                        v.detectStatus === "failed"
                                          ? "比例偵測失敗；請確認主機已安裝 ffmpeg（ffprobe）或手動選擇比例"
                                          : v.detectSource === "metadata"
                                            ? "從檔案偵測"
                                            : v.detectSource === "filename"
                                              ? "從檔名推測"
                                              : "手動選擇／已確認"
                                      }
                                    >
                                      {v.detectStatus === "success"
                                        ? "真偵測"
                                        : v.detectStatus === "manual_confirmed"
                                          ? "已確認"
                                          : v.detectStatus === "fallback"
                                            ? "推測"
                                            : "待確認"}
                                    </Badge>
                                  )}
                                  {v.groupId && (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      {v.groupSource === "manual" ? "人工組" : "建議組"}
                                    </Badge>
                                  )}
                                  {!v.groupId && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-normal border-amber-500/50 text-amber-600"
                                    >
                                      未歸組
                                    </Badge>
                                  )}
                                  <span>·</span>
                                  <span>{formatDate(v.createdAt)}</span>
                                </div>
                                {v.isPrimary && (
                                  <Badge variant="secondary" className="w-fit text-xs">
                                    主版本
                                  </Badge>
                                )}
                                <AssetVersionIntelligenceStrip assetVersionId={v.id} />
                                <div className="flex items-center gap-1 mt-auto">
                                  {!v.isPrimary && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => wb.setVersionPrimary(v)}
                                      title="設為主版本"
                                    >
                                      <Star className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => wb.openEditVersion(v)}
                                    title="編輯"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => wb.setDeleteVersionTarget(v)}
                                    title="刪除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">素材包主檔</h3>
          {wb.packageSubmitError && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-4">
              {wb.packageSubmitError}
              {wb.packageSubmitErrors != null &&
                typeof wb.packageSubmitErrors === "object" &&
                "fieldErrors" in (wb.packageSubmitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">
                    {JSON.stringify((wb.packageSubmitErrors as { fieldErrors?: unknown }).fieldErrors, null, 2)}
                  </pre>
                )}
            </div>
          )}
          <PackageFormFields form={wb.packageForm} setForm={wb.setPackageForm} mode="edit" />
          <div className="flex gap-2 mt-4">
            <Button onClick={wb.savePackage} disabled={wb.packageSaving}>
              {wb.packageSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              儲存
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => wb.selectedPackageForForm && wb.setDeletePackageTarget(wb.selectedPackageForForm)}
              disabled={wb.packageSaving}
            >
              刪除素材包
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
