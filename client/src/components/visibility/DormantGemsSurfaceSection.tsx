import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DormantGemCandidateItem } from "@/pages/dashboard/dashboard-types";
import {
  buildDormantGemReasonSummary,
  buildDormantGemReviveRecommendation,
  buildDormantGemWhyPausedHint,
  buildDormantGemWhyWorthRevivingHint,
  sortDormantGemCandidatesByRevivalValue,
} from "@shared/visibility-policy";

export type DormantGemsSurface = "dashboard" | "products" | "fb-ads" | "creative-intelligence";

function reasonFor(c: DormantGemCandidateItem): string {
  if (c.reasonSummary?.trim()) return c.reasonSummary;
  return buildDormantGemReasonSummary({
    visibilityTier: c.visibilityTier,
    pauseSignals: c.pauseSignals ?? [],
    roas7d: c.roas7d ?? null,
    opportunityScore: c.opportunityScore ?? null,
    healthScore: c.healthScore ?? null,
    trailingSpend7d: c.trailingSpend7d ?? 0,
    trailingSpend14d: c.trailingSpend14d ?? 0,
  });
}

function reviveFor(c: DormantGemCandidateItem): string {
  if (c.reviveRecommendation?.trim()) return c.reviveRecommendation;
  return buildDormantGemReviveRecommendation({
    visibilityTier: c.visibilityTier,
    roas7d: c.roas7d ?? null,
  });
}

function whyPausedFor(c: DormantGemCandidateItem): string {
  if (c.whyPausedHint?.trim()) return c.whyPausedHint;
  return buildDormantGemWhyPausedHint({
    visibilityTier: c.visibilityTier,
    pauseSignals: c.pauseSignals ?? [],
    status: c.status ?? "",
  });
}

function whyReviveFor(c: DormantGemCandidateItem): string {
  if (c.whyWorthRevivingHint?.trim()) return c.whyWorthRevivingHint;
  return buildDormantGemWhyWorthRevivingHint({
    roas7d: c.roas7d ?? null,
    opportunityScore: c.opportunityScore ?? null,
    healthScore: c.healthScore ?? null,
    trailingSpend7d: c.trailingSpend7d ?? 0,
    trailingSpend14d: c.trailingSpend14d ?? 0,
  });
}

type TierFilter = "all" | "paused_winner_bucket" | "dormant_gem_bucket";

export function DormantGemsSurfaceSection({
  candidates,
  surface,
}: {
  candidates: DormantGemCandidateItem[];
  surface: DormantGemsSurface;
}) {
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const testId =
    surface === "dashboard"
      ? "dashboard-dormant-gems-section"
      : surface === "products"
        ? "products-dormant-gems-section"
        : surface === "fb-ads"
          ? "fb-ads-dormant-gems-section"
          : "creative-intelligence-dormant-gems-section";

  const anchorId = `dormant-gems-primary-${surface}`;

  const sortedFiltered = useMemo(() => {
    const base = sortDormantGemCandidatesByRevivalValue(candidates ?? []);
    if (tierFilter === "all") return base;
    return base.filter((c) => c.visibilityTier === tierFilter);
  }, [candidates, tierFilter]);

  if (!candidates?.length) {
    return (
      <div data-testid="dormant-gems-operational-shell-v6">
      <div data-testid="dormant-gems-surface-v2">
        <div data-testid="dormant-gem-primary-work-object-v6" className="min-w-0">
        <Card
          className="border-dashed border-violet-300/60 bg-violet-50/12 dark:bg-violet-950/10"
          data-testid={testId}
          id={anchorId}
        >
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-base font-semibold text-violet-950 dark:text-violet-100">
              主工作物件：沉睡／暫停高潛（復活候選）
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal leading-snug">
              目前無符合政策的候選。零花費但<strong>非</strong>本列者，請看「可見性政策」與 no_delivery／樣本不足診斷—與本桶<strong>分開</strong>。
            </p>
            <div
              className="rounded-md border border-violet-200/60 dark:border-violet-800/40 bg-background/60 px-2.5 py-2 text-[11px] text-muted-foreground leading-snug"
              data-testid="dormant-zero-spend-classification-legend"
            >
              <p className="font-medium text-violet-950 dark:text-violet-100 mb-1">零花費分類（主清單不混無行動價值列）</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  <strong>沉睡高潛／暫停贏家</strong>：尾隨花費 + 正向訊號達門檻—本區操作物件。
                </li>
                <li>
                  <strong>no_delivery／樣本不足</strong>：診斷列，排序在後、不當復活主線。
                </li>
                <li>
                  <strong>Stale／無法行動</strong>：缺批次或範圍不一致—先同步再判斷。
                </li>
              </ul>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4" data-testid="dormant-gems-empty-state">
            <p className="text-xs text-muted-foreground">
              操作：同步資料後於{" "}
              <Link href="/fb-ads" className="text-primary underline-offset-2 hover:underline">
                預算控制
              </Link>{" "}
              檢視活動狀態；政策說明見{" "}
              <span className="font-mono text-[10px]">docs/DORMANT-GEM-OPERATIONAL-POLICY.md</span>。
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div data-testid="dormant-gems-operational-shell-v6">
    <div data-testid="dormant-gems-surface-v2">
      <div data-testid="dormant-gem-primary-work-object-v6" className="min-w-0">
      <Card className="border border-violet-300/55 bg-violet-50/20 dark:bg-violet-950/12 shadow-sm" data-testid={testId} id={anchorId}>
        <CardHeader className="py-3 pb-2 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-violet-950 dark:text-violet-100">
                主工作物件：沉睡／暫停高潛名單（可復活）
              </CardTitle>
              <p className="text-xs text-muted-foreground font-normal leading-snug mt-1">
                預設依 <strong className="text-foreground/90">revivalPriorityScore（P 分）</strong> 穩定排序；可篩分桶。含復活建議、暫停理由、值得救理由。
              </p>
            </div>
            <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
              <SelectTrigger
                className="w-[160px] h-8 text-xs"
                data-testid="dormant-gem-filter-tier-v4"
                aria-label="篩選沉睡分桶"
              >
                <SelectValue placeholder="分桶" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部候選</SelectItem>
                <SelectItem value="paused_winner_bucket">暫停贏家</SelectItem>
                <SelectItem value="dormant_gem_bucket">沉睡高潛</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div
            className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-primary"
            data-testid="dormant-gem-action-shortcuts-v4"
          >
            <Link href="/judgment" className="underline-offset-2 hover:underline font-medium">
              審判工作台（情境下指令）
            </Link>
            <Link href="/fb-ads" className="underline-offset-2 hover:underline font-medium">
              預算與投放狀態
            </Link>
            {surface !== "products" ? (
              <Link href="/products" className="underline-offset-2 hover:underline font-medium">
                商品戰報
              </Link>
            ) : null}
            {surface !== "creative-intelligence" ? (
              <Link href="/creative-intelligence" className="underline-offset-2 hover:underline font-medium">
                創意情報
              </Link>
            ) : null}
          </div>
          <div
            className="rounded-md border border-violet-200/50 dark:border-violet-800/40 bg-background/50 px-2.5 py-1.5 text-[10px] text-muted-foreground"
            data-testid="dormant-zero-spend-classification-legend"
          >
            零花費：本列 = 高潛復活主物件；診斷與 stale 見政策與預算頁—主清單不混入無行動價值項。
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 text-sm">
          {sortedFiltered.slice(0, 40).map((c) => (
            <div
              key={`${c.campaignId}-${surface}`}
              className="flex flex-col gap-1.5 border-b border-border/50 pb-3 last:border-0 last:pb-0"
              data-testid="dormant-gem-operational-row"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.campaignName}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.productName} · 7d {Number(c.trailingSpend7d ?? 0).toFixed(0)} · 14d{" "}
                    {Number(c.trailingSpend14d ?? 0).toFixed(0)}
                    {c.roas7d != null ? ` · 7d ROAS ${Number(c.roas7d).toFixed(2)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {c.revivalPriorityScore != null ? (
                    <Badge variant="secondary" className="text-[10px] font-mono tabular-nums">
                      P{c.revivalPriorityScore}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="text-[10px] uppercase tracking-tight">
                    {c.visibilityTier === "paused_winner_bucket" ? "暫停贏家" : "沉睡高潛"}
                  </Badge>
                </div>
              </div>
              <p
                className="text-[11px] text-violet-900/90 dark:text-violet-100/90 leading-snug border-l-2 border-violet-300/60 pl-2"
                data-testid="dormant-gem-reason-line"
              >
                {reasonFor(c)}
              </p>
              <p
                className="text-[11px] text-emerald-900/90 dark:text-emerald-100/85 leading-snug border-l-2 border-emerald-400/50 pl-2"
                data-testid="dormant-gem-revive-recommendation"
              >
                {reviveFor(c)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug pl-2" data-testid="dormant-gem-why-paused">
                {whyPausedFor(c)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug pl-2" data-testid="dormant-gem-why-revive">
                {whyReviveFor(c)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>
    </div>
    </div>
  );
}
