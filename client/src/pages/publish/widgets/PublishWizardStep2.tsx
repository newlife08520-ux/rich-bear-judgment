import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Film } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetThumbnailImg, toAbsoluteUploadUrl } from "@/components/AssetThumbnailImg";
import { assetTypeLabels, assetAspectRatioLabels } from "@shared/schema";
import type { PublishWorkbench } from "../usePublishWorkbench";

export function PublishWizardStep2({ wb }: { wb: PublishWorkbench }) {
  const {
    form,
    setForm,
    packages,
    versions,
    batchGroups,
    selectedBatchGroupKeys,
    setSelectedBatchGroupKeys,
    onSelectPackage,
    toggleVersion,
    handleBatchCreate,
    batchCreating,
  } = wb;
  return (
<>
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-4">選素材包</h3>
                {packages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">尚無素材包，請先至「素材中心」建立</p>
                ) : (
                  <Select value={form.assetPackageId || "_none"} onValueChange={(v) => v !== "_none" && onSelectPackage(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇一個素材包（會自動帶入主文案、標題、CTA、網址）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 請選擇 —</SelectItem>
                      {packages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} · {p.brandProductName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* 3. 選素材版本 */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-4">選素材版本（可多選，支援同組不同尺寸）</h3>
                {!form.assetPackageId ? (
                  <p className="text-sm text-muted-foreground">請先選擇素材包</p>
                ) : versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">此素材包尚無版本，請至素材中心新增</p>
                ) : (
                  <>
                  {/* 快速變體：選擇主素材組一次帶入該組所有版本 */}
                  {batchGroups.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg border bg-muted/30">
                      <p className="text-sm font-medium mb-2">快速填入：選擇主素材組</p>
                      <div className="flex flex-wrap gap-2">
                        {batchGroups.map((g) => {
                          const isSelected =
                            g.versionIds.length > 0 &&
                            g.versionIds.every((id) => form.selectedVersionIds.includes(id)) &&
                            form.selectedVersionIds.length === g.versionIds.length;
                          return (
                            <Button
                              key={g.groupKey}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  selectedVersionIds: isSelected ? [] : g.versionIds,
                                }))
                              }
                            >
                              {g.label}
                              <span className="text-muted-foreground ml-1 text-xs">
                                （{g.ratios.map((r) => assetAspectRatioLabels[r as keyof typeof assetAspectRatioLabels] ?? r).join("/")}）
                              </span>
                              {g.isFallback ? (
                                <Badge variant="secondary" className="ml-1 text-xs">未歸組</Badge>
                              ) : (
                                <Badge variant="outline" className="ml-1 text-xs font-normal text-muted-foreground">
                                  {g.versions.every((x) => x.groupSource === "suggested") ? "建議" : "人工"}
                                </Badge>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-3">
                    {versions.map((v) => {
                      const isImage = (v.fileType || "").startsWith("image");
                      const isVideo = v.assetType === "video";
                      const isSelected = form.selectedVersionIds.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer",
                            isSelected
                              ? "border-indigo-600 bg-slate-50 ring-2 ring-indigo-200 dark:border-indigo-500 dark:bg-muted/40 dark:ring-indigo-900/40"
                              : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleVersion(v.id)}
                        >
                          <Checkbox
                            id={`ver-${v.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleVersion(v.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center border">
                            {isImage && (v.thumbnailUrl || v.fileUrl) ? (
                              <AssetThumbnailImg
                                versionId={v.id}
                                url={toAbsoluteUploadUrl(v.thumbnailUrl || v.fileUrl)}
                                className="w-full h-full object-cover"
                              />
                            ) : isVideo ? (
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
                                <Film className="w-8 h-8 text-muted-foreground" />
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">檔案</span>
                            )}
                          </div>
                          <label htmlFor={`ver-${v.id}`} className="text-sm cursor-pointer flex-1 min-w-0">
                            <span className="font-medium block truncate">{v.fileName}</span>
                            <span className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs font-medium">{assetAspectRatioLabels[v.aspectRatio]}</Badge>
                              <span className="text-muted-foreground text-xs">{assetTypeLabels[v.assetType]}</span>
                              {v.detectStatus && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs font-normal",
                                    v.detectStatus === "success" && "border-emerald-500/50 text-emerald-700",
                                    v.detectStatus === "manual_confirmed" && "text-muted-foreground",
                                    v.detectStatus === "fallback" && "border-amber-400/50 text-amber-600",
                                    v.detectStatus === "failed" && "border-amber-500/50 text-amber-700"
                                  )}
                                  title={v.detectSource === "metadata" ? "從檔案偵測" : v.detectSource === "filename" ? "從檔名推測" : "手動／已確認"}
                                >
                                  {v.detectStatus === "success" ? "真偵測" : v.detectStatus === "manual_confirmed" ? "已確認" : v.detectStatus === "fallback" ? "推測" : "待確認"}
                                </Badge>
                              )}
                              {v.isPrimary && (
                                <Badge className="text-xs bg-indigo-50 text-indigo-800 border-indigo-200 border dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800/50">
                                  主版本
                                </Badge>
                              )}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {/* 批次建組：依主素材分組，一組 = 同一主素材的多尺寸版本 */}
                  {batchGroups.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <h4 className="text-sm font-medium">批次建組（依主素材分組，一組一筆草稿）</h4>
                      <div className="space-y-2">
                        {batchGroups.map((g) => (
                          <div
                            key={g.groupKey}
                            className={cn(
                              "rounded-lg border p-3 space-y-2",
                              g.isFallback && "border-slate-200 bg-slate-50 border-l-4 border-l-amber-500 dark:border-border dark:bg-muted/30"
                            )}
                          >
                            <label className="flex items-start gap-2 cursor-pointer">
                              <Checkbox
                                checked={selectedBatchGroupKeys.has(g.groupKey)}
                                onCheckedChange={(checked) => {
                                  setSelectedBatchGroupKeys((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(g.groupKey);
                                    else next.delete(g.groupKey);
                                    return next;
                                  });
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{g.label}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  含 {g.ratios.map((r) => assetAspectRatioLabels[r as keyof typeof assetAspectRatioLabels] ?? r).join(" / ")} · {g.count} 個版本
                                </span>
                                {g.isFallback ? (
                                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-500/50">未歸組</Badge>
                                ) : (
                                  <Badge variant="outline" className="ml-2 text-muted-foreground">
                                    {g.versions.length > 0 && g.versions.every((x) => x.groupSource === "suggested") ? "系統建議" : "人工指定"}
                                  </Badge>
                                )}
                                {g.isFallback && (
                                  <span className="text-xs text-amber-600 ml-1">fallback 分組，不建議直接批次建組</span>
                                )}
                                <div className="text-xs text-muted-foreground mt-1 truncate" title={g.versions.map((x) => x.fileName).join(", ")}>
                                  {g.versions.map((x) => x.fileName).join(" · ")}
                                </div>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedBatchGroupKeys.size > 0 && (() => {
                        const audienceCodesCount = (form.audienceCodesComma ?? "")
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean).length;
                        const matrixCount = audienceCodesCount > 0 ? audienceCodesCount * selectedBatchGroupKeys.size : selectedBatchGroupKeys.size;
                        return (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleBatchCreate}
                            disabled={
                              batchCreating ||
                              !form.accountId ||
                              (form.budgetDaily?.trim() ? false : !form.budgetTotal?.trim()) ||
                              audienceCodesCount === 0
                            }
                          >
                            {batchCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {audienceCodesCount > 0
                              ? `一鍵建立 ${matrixCount} 筆草稿（${audienceCodesCount} 受眾 × ${selectedBatchGroupKeys.size} 素材組）`
                              : `一次建立 ${selectedBatchGroupKeys.size} 筆草稿（請先填受眾代碼）`}
                          </Button>
                        );
                      })()}
                    </div>
                  )}
                  </>
                )}
              </CardContent>
            </Card>
</>
  );
}
