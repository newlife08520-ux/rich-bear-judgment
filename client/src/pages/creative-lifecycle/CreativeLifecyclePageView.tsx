import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Wallet, Archive, ListPlus, Filter, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CreativeLifecycleWorkbench } from "./useCreativeLifecycleWorkbench";
import { STAGE_OPTIONS, LABEL_OPTIONS } from "./lifecycle-constants";
import { LifecycleColumn } from "./widgets/LifecycleColumn";
import { LabelBadge } from "./widgets/LabelBadge";
import { FirstDecisionBlock } from "./widgets/FirstDecisionBlock";

export function CreativeLifecyclePageView({ wb }: { wb: CreativeLifecycleWorkbench }) {
  const {
    stageFilter,
    setStageFilter,
    labelFilter,
    setLabelFilter,
    highlightCardRef,
    isLoading,
    items,
    displayItems,
    hasCreativeKeyFilter,
    creativeKeyFromUrl,
    highlightId,
    success,
    underfunded,
    retired,
    inspirationPool,
    firstDecisionMin,
    firstDecisionMax,
    suggestions,
    createTasksMutation,
    luckyCount,
    createLuckyTasksMutation,
    invalidateLifecycle,
  } = wb;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="page-title">素材生命週期</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            7 階段：待初審 → 待驗證 → 第一次決策點（花費 {firstDecisionMin}–{firstDecisionMax}）→ 存活池 → 拉升池 → 死亡池 → 靈感池。
          </p>
        </div>
      </header>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">素材清單（7 階段 + 完整判決欄位）</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {luckyCount > 0 && (
                <Button size="sm" variant="secondary" onClick={() => createLuckyTasksMutation.mutate()} disabled={createLuckyTasksMutation.isPending}>
                  Lucky 一鍵生成補量任務 ({luckyCount})
                </Button>
              )}
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={stageFilter || "all"} onValueChange={(v) => setStageFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="依階段" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={labelFilter || "all"} onValueChange={(v) => setLabelFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="依 ROI label" />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">載入中…</p>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center space-y-4">
                <p className="text-sm font-medium text-muted-foreground">尚無素材或尚未達門檻</p>
                <p className="text-xs text-muted-foreground">請先上傳素材、建立投放草稿或同步廣告與轉換資料，達門檻後會在此顯示。</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/assets">前往素材中心上傳</a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/publish">前往投放中心建立草稿</a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/settings">前往設定中心同步資料</a>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {hasCreativeKeyFilter && displayItems.length === 0 && (
                  <p className="text-sm text-amber-600 mb-3">未找到 campaignId/ID 或名稱含「{creativeKeyFromUrl}」的素材，顯示全部。</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayItems.map((i) => (
                    <Card
                      key={i.id}
                      ref={i.id === highlightId ? highlightCardRef : undefined}
                      className={cn(
                        "border bg-card",
                        i.id === highlightId && "ring-2 ring-indigo-300 bg-slate-50 dark:ring-indigo-700 dark:bg-muted/40"
                      )}
                    >
                      <CardContent className="p-3 text-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium truncate" title={i.name}>{i.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {i.stage && <Badge variant="outline" className="text-xs">{i.stage}</Badge>}
                            <LabelBadge label={i.label} />
                          </div>
                        </div>
                        {i.stage === "第一次決策點" && (
                          <FirstDecisionBlock
                            campaignId={i.campaignId ?? i.id}
                            name={i.name}
                            suggestedAction={i.suggestedAction}
                            suggestedPct={i.suggestedPct}
                            savedDecision={i.savedDecision}
                            firstDecisionMin={firstDecisionMin}
                            firstDecisionMax={firstDecisionMax}
                            onDecisionSaved={invalidateLifecycle}
                          />
                        )}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>ROAS {i.roas.toFixed(2)}</span>
                          <span>Spend NT${i.spend.toLocaleString()}</span>
                          {i.scaleReadinessScore != null && <span className="col-span-2">Scale Readiness {i.scaleReadinessScore}</span>}
                          {i.suggestedAction != null && (
                            <span className="col-span-2">
                              建議動作 {i.suggestedAction}{" "}
                              {i.suggestedPct != null && i.suggestedPct !== "關閉" ? `${i.suggestedPct}%` : i.suggestedPct === "關閉" ? "關閉" : ""}
                            </span>
                          )}
                          <span>ATC {i.atc}</span>
                          <span>Purchase {i.purchase}</span>
                        </div>
                        {i.whyNotMore && (
                          <p className="text-xs border-t pt-1.5 text-muted-foreground">
                            <span className="font-medium">為什麼不是更大或更小：</span>{i.whyNotMore}
                          </p>
                        )}
                        {i.forBuyer && (
                          <p className="text-xs border-t pt-1.5 text-muted-foreground"><span className="font-medium">給投手：</span>{i.forBuyer}</p>
                        )}
                        {i.forDesign && (
                          <p className="text-xs border-t pt-1.5 text-muted-foreground"><span className="font-medium">給設計：</span>{i.forDesign}</p>
                        )}
                        {i.firstReviewVerdict && i.firstReviewVerdict !== "—" && (
                          <p className="text-xs text-muted-foreground">初審判決：{i.firstReviewVerdict}</p>
                        )}
                        {i.battleVerdict && <p className="text-xs text-muted-foreground">實戰判決：{i.battleVerdict}</p>}
                        {i.reason && <p className="text-xs border-t pt-1.5 text-muted-foreground">{i.reason}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!isLoading && inspirationPool.length > 0 && (
          <Card className="border-slate-200 bg-white border-l-4 border-l-indigo-500 dark:border-border dark:bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                靈感池（設計可用的延伸素材）
              </CardTitle>
              <p className="text-sm text-muted-foreground">高 Creative Edge、漏斗不差、花費仍低，供設計與投手優先延伸。</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {inspirationPool.slice(0, 15).map((c, idx) => (
                  <li key={idx} className="rounded-lg border p-3 text-sm space-y-1.5">
                    <div className="font-medium">{c.productName} · {c.materialStrategy}</div>
                    <div className="text-xs text-muted-foreground">
                      Spend NT${c.spend.toLocaleString()} · ROAS {c.roas.toFixed(2)} · Edge {c.creativeEdge.toFixed(2)}
                    </div>
                    <p className="text-xs"><span className="font-medium">贏在哪：</span>{c.winReason}</p>
                    <p className="text-xs"><span className="font-medium">建議延伸：</span>{c.extendDirection}</p>
                    <p className="text-xs"><span className="font-medium">設計可借：</span>{c.designTakeaway}</p>
                  </li>
                ))}
                {inspirationPool.length > 15 && <li className="text-muted-foreground text-sm">…共 {inspirationPool.length} 筆</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LifecycleColumn title="成功／穩定 (Winner)" icon={TrendingUp} items={success} variant="success" />
            <LifecycleColumn title="預算不足 (Underfunded)" icon={Wallet} items={underfunded} variant="underfunded" />
            <LifecycleColumn title="已疲勞／Lucky／建議停" icon={Archive} items={retired} variant="retired" />
          </div>
        )}

        {suggestions.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListPlus className="w-4 h-4" />
                汰換建議（加碼／淘汰／補素材）
              </CardTitle>
              <Button size="sm" onClick={() => createTasksMutation.mutate()} disabled={createTasksMutation.isPending}>
                一鍵生成任務
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
                {suggestions.slice(0, 15).map((s, idx) => (
                  <li key={idx} className="flex justify-between gap-2">
                    <span className="truncate">{s.campaignName}</span>
                    <span className="text-muted-foreground shrink-0">{s.suggestion} · {s.action}</span>
                  </li>
                ))}
                {suggestions.length > 15 && <li className="text-muted-foreground">…共 {suggestions.length} 筆</li>}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
