import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { publishStatusLabels, publishStatuses, type PublishStatus } from "@shared/schema";
import { META_CTA_OPTIONS } from "../publish-constants";
import type { PublishWorkbench } from "../usePublishWorkbench";

export function PublishWizardStep3({ wb }: { wb: PublishWorkbench }) {
  const {
    guardCheck,
    form,
    setForm,
    metaPages,
    metaPagesNoFilter,
    igAccountsForSelectedPage,
    placementIncludesIg,
    selectedPageHasNoIg,
    preflight,
    selectedPackage,
    effectivePrimaryCopy,
    effectiveHeadline,
    effectiveCta,
    effectiveNote,
    effectiveLandingPageUrl,
    advancedOpen,
    setAdvancedOpen,
    toast,
  } = wb;
  return (
<>
            {guardCheck?.metaWritesAllowed === false && (
              <div
                className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-amber-500 px-3 py-2 text-xs text-amber-950 dark:border-border dark:bg-card dark:text-amber-100"
                data-testid="publish-wizard-meta-guard-hint"
              >
                <span className="font-semibold">Meta 寫入未啟用</span>
                <span className="text-muted-foreground dark:text-amber-100/80"> — 可先完成草稿並儲存；啟用後再由列表「確認送出至 Meta」。</span>
                {guardCheck?.message ? <span className="block mt-1 text-amber-900/90 dark:text-amber-100/90">{guardCheck.message}</span> : null}
              </div>
            )}
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">投放身分摘要（粉專／IG）</h3>
                <p className="text-xs text-muted-foreground mb-2">粉專與 IG 請於「基本設定」選擇；預覽與送出將使用此身分。</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Facebook 粉專</dt>
                    <dd className="font-medium">{form.pageId ? (metaPages.find((p) => p.id === form.pageId)?.name ?? form.pageId) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Instagram</dt>
                    <dd className="font-medium">{form.igAccountId ? (igAccountsForSelectedPage.find((i) => i.id === form.igAccountId)?.username ? `@${igAccountsForSelectedPage.find((i) => i.id === form.igAccountId)!.username}` : form.igAccountId) : "—"}</dd>
                  </div>
                </dl>
                {metaPagesNoFilter && metaPages.length > 0 && (
                  <p className="text-xs text-amber-600 mt-2">目前為 Token 下全部粉專，未依廣告帳號過濾，請自行確認對應關係。</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">投放前檢查</h3>
                <p className="text-xs text-muted-foreground mb-3">建立草稿前請確認以下項目</p>
                <ul className="space-y-1.5 text-sm">
                  <li className={cn("flex items-center gap-2", preflight.hasAccount ? "text-foreground" : "text-destructive")}>
                    {preflight.hasAccount ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                    已選廣告帳號
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.hasPage ? "text-foreground" : "text-destructive")}>
                    {preflight.hasPage ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                    已選 Facebook 粉專
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.hasIgWhenRequired ? "text-foreground" : "text-destructive")}>
                    {preflight.hasIgWhenRequired ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                    {placementIncludesIg ? "已選 IG 帳號（placement 含 IG 必填）" : "IG 選填"}
                  </li>
                  {selectedPageHasNoIg && (
                    <li className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      此粉專未綁定 IG，無法投放 Reels/Stories；請回基本設定改選「僅動態牆」或綁定 IG
                    </li>
                  )}
                  <li className={cn("flex items-center gap-2", preflight.ctaValid ? "text-foreground" : "text-amber-600")}>
                    {preflight.ctaValid ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                    CTA 有效（未填時預設「來去逛逛」）
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.hasVersions ? "text-foreground" : "text-destructive")}>
                    {preflight.hasVersions ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                    已選素材版本
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.allHaveTypeAndRatio ? "text-foreground" : "text-destructive")}>
                    {preflight.allHaveTypeAndRatio ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                    每個版本皆有類型與比例
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.hasFallbackInSelection ? "text-amber-600" : "text-foreground")}>
                    {preflight.hasFallbackInSelection ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4 text-emerald-600" />}
                    {preflight.hasFallbackInSelection ? "選中含 fallback 分組，不建議直接批次建組" : "無 fallback 分組或未選中"}
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.singleSizeWarning ? "text-amber-600" : "text-foreground")}>
                    {preflight.singleSizeWarning ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4 text-emerald-600" />}
                    {preflight.singleSizeWarning ? "僅單一尺寸，建議補齊多比例（不阻擋）" : "多尺寸或未選版本"}
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.landingPageExists ? "text-foreground" : "text-amber-600")}>
                    {preflight.landingPageExists ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4" />}
                    落地頁網址 {preflight.landingPageExists ? "已填" : "未填"}
                  </li>
                </ul>
                {preflight.anyVersionDetectFailed && (
                  <p className="text-xs text-amber-600 mt-2">部分版本偵測失敗，比例為手動或推測，請確認後再送出</p>
                )}
              </CardContent>
            </Card>

            {/* 4. 覆寫區：必要時才改文案 */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">覆寫文案（選填）</h3>
                <p className="text-xs text-muted-foreground mb-4">預設沿用素材包；只有要改時才填</p>

                {/* 送出時將使用：一眼看出實際會送出的內容 */}
                <div className="rounded-lg border bg-muted/40 p-3 mb-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">送出時將使用：</p>
                  <dl className="text-xs space-y-1">
                    <div><dt className="text-muted-foreground inline">粉專：</dt><dd className="inline break-words">{form.pageId ? (metaPages.find((p) => p.id === form.pageId)?.name ?? form.pageId) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">IG：</dt><dd className="inline break-words">{form.igAccountId ? (igAccountsForSelectedPage.find((i) => i.id === form.igAccountId)?.username ? `@${igAccountsForSelectedPage.find((i) => i.id === form.igAccountId)!.username}` : form.igAccountId) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">主文案：</dt><dd className="inline break-words">{effectivePrimaryCopy || "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">標題：</dt><dd className="inline break-words">{effectiveHeadline || "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">CTA：</dt><dd className="inline break-words">{(effectiveCta || "來去逛逛")}</dd></div>
                    <div><dt className="text-muted-foreground inline">說明：</dt><dd className="inline break-words">{effectiveNote || "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">網址：</dt><dd className="inline break-words">{effectiveLandingPageUrl || "—"}</dd></div>
                  </dl>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>主文案</Label>
                    <Textarea value={form.primaryCopy} onChange={(e) => setForm((f) => ({ ...f, primaryCopy: e.target.value }))} rows={2} placeholder="未填則沿用素材包" />
                    <p className="text-xs text-muted-foreground">
                      {(form.primaryCopy ?? "").trim() ? "已覆寫" : selectedPackage?.primaryCopy ? `沿用素材包：${selectedPackage.primaryCopy.slice(0, 40)}${(selectedPackage.primaryCopy?.length ?? 0) > 40 ? "…" : ""}` : "未填，送出時無此內容"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>標題</Label>
                      <Input value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder="未填則沿用素材包" />
                      <p className="text-xs text-muted-foreground">
                        {(form.headline ?? "").trim() ? "已覆寫" : selectedPackage?.headline ? `沿用素材包：${selectedPackage.headline}` : "未填"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>CTA</Label>
                      <Select
                        value={(form.cta ?? "").trim() || "來去逛逛"}
                        onValueChange={(v) => setForm((f) => ({ ...f, cta: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="來去逛逛" /></SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const current = (form.cta ?? "").trim();
                            const opts = current && !META_CTA_OPTIONS.includes(current) ? [current, ...META_CTA_OPTIONS] : META_CTA_OPTIONS;
                            return opts.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {(form.cta ?? "").trim() ? "已選擇" : selectedPackage?.cta ? `沿用素材包：${selectedPackage.cta}` : "預設：來去逛逛"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>說明 / 備註</Label>
                    <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="選填，多數情況可留空" />
                    <p className="text-xs text-muted-foreground">
                      {(form.note ?? "").trim() ? "已覆寫" : selectedPackage?.note ? `沿用素材包：${(selectedPackage.note?.length ?? 0) > 40 ? selectedPackage.note.slice(0, 40) + "…" : selectedPackage.note}` : "選填，多數可留空"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>落地頁網址</Label>
                    <Input value={form.landingPageUrl} onChange={(e) => setForm((f) => ({ ...f, landingPageUrl: e.target.value }))} placeholder="多數沿用素材包，未填則用素材包網址" />
                    <p className="text-xs text-muted-foreground">
                      {(form.landingPageUrl ?? "").trim() ? "已覆寫" : selectedPackage?.landingPageUrl ? `沿用素材包：${selectedPackage.landingPageUrl}` : "未填"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 -ml-2">
                  <ChevronRight className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-90")} />
                  進階選項
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pt-2 pl-2 border-l-2 border-muted">
                  <Label className="text-muted-foreground">狀態</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PublishStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {publishStatuses.map((k) => (
                        <SelectItem key={k} value={k}>{publishStatusLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">新建草稿預設為「草稿」；僅在需要時改為待發佈等</p>
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const name = window.prompt("範本名稱", `範本_${new Date().toISOString().slice(0, 10)}`);
                        if (!name?.trim()) return;
                        const res = await fetch("/api/publish/templates", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            name: name.trim(),
                            accountId: form.accountId || undefined,
                            pageId: form.pageId || undefined,
                            igAccountId: form.igAccountId || undefined,
                            budgetDaily: form.budgetDaily?.trim() ? Number(form.budgetDaily) : undefined,
                            budgetTotal: form.budgetTotal?.trim() ? Number(form.budgetTotal) : undefined,
                            audienceStrategy: form.audienceStrategy,
                            placementStrategy: form.placementStrategy,
                            cta: (form.cta ?? "").trim() || undefined,
                            landingPageUrl: (form.landingPageUrl ?? "").trim() || undefined,
                            campaignNameTemplate: "{product}_{date}_{ratio}_{seq}",
                            adSetNameTemplate: "{product}_{date}_{ratio}_{seq}",
                            adNameTemplate: "{product}_{ratio}_{seq}",
                          }),
                        });
                        if (res.ok) {
                          queryClient.invalidateQueries({ queryKey: ["/api/publish/templates"] });
                          toast({ title: "已儲存範本", description: name.trim() });
                        } else {
                          const data = await res.json().catch(() => ({}));
                          toast({ title: "儲存失敗", description: (data as { message?: string }).message, variant: "destructive" });
                        }
                      }}
                    >
                      將目前設定儲存為範本
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
</>
  );
}
