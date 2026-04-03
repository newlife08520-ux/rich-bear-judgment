/**
 * Batch 14.1 v11：War-room 艦橋 — 第一屏降噪；編隊教範預設收合；truth tier 更貼決策動線。
 */
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DiagnosticsFold } from "@/components/strategic-panel";

export function HomepageCommandPanelV11Chrome({
  children,
  partialHomepage,
}: {
  children: ReactNode;
  partialHomepage: boolean;
}) {
  return (
    <div
      data-testid="section-homepage-first-screen-command-v11"
      className="rounded-xl border border-border/55 bg-gradient-to-b from-slate-950/[0.08] via-background/60 to-background shadow-sm p-3 md:p-4 space-y-3"
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">War room · v11</p>
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">今日作戰面板</h2>
          <p className="text-[9px] text-muted-foreground max-w-xl leading-snug">
            先 Top 3 → 信不信任 → 放大／救援／復活；編隊細節預設收合。
          </p>
        </div>
        <div
          className="rounded border border-dashed border-primary/40 bg-primary/[0.03] px-1.5 py-1 text-[8px] text-muted-foreground max-w-[200px] leading-tight shrink-0"
          data-testid="block-war-room-deck-v11"
        >
          規則缺失／漂移 → Diagnostics；不佔主決策位。
        </div>
      </header>

      <Collapsible defaultOpen={false} data-testid="collapsible-war-room-doctrine-v11">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border-y border-border/40 bg-muted/10 px-2 py-1 text-[9px] font-medium text-muted-foreground hover:bg-muted/25">
          <span>編隊教範（Decision now／soon／Diagnostics ＋ 四跑道）</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1.5 pt-1.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[9px]" data-testid="block-command-hierarchy-v11">
            <div
              className="rounded-md border-l-2 border-l-emerald-500/70 bg-emerald-500/[0.05] px-2 py-1"
              data-testid="lane-command-decision-now-v11"
            >
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">Decision now</p>
              <p className="text-muted-foreground mt-0.5 leading-tight">Top 動作、漏錢、五區可信值。</p>
            </div>
            <div
              className="rounded-md border border-amber-500/40 bg-amber-500/[0.07] px-2 py-1"
              data-testid="lane-command-decision-soon-v11"
            >
              <p className="font-semibold text-amber-950 dark:text-amber-100">Decision soon</p>
              <p className="text-muted-foreground mt-0.5 leading-tight">放大、沉睡排序、節奏待確認。</p>
            </div>
            <div
              className="rounded-md border-l-2 border-dashed border-l-slate-500/50 bg-slate-500/[0.04] px-2 py-1"
              data-testid="lane-command-diagnostics-only-v11"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">Diagnostics only</p>
              <p className="text-muted-foreground mt-0.5 leading-tight">缺規則、範圍漂移、摘要晚到。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 text-[9px]">
            <div
              className="rounded-md border border-emerald-500/40 bg-emerald-500/[0.07] px-2 py-1"
              data-testid="lane-war-today-first-v11"
            >
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">1 · 今日先打</p>
            </div>
            <div
              className="rounded-md border border-rose-500/35 bg-rose-500/[0.07] px-2 py-1"
              data-testid="lane-war-money-leak-v11"
            >
              <p className="font-semibold text-rose-900 dark:text-rose-100">2 · 漏錢救援</p>
            </div>
            <div
              className="rounded-md border border-amber-500/35 bg-amber-500/[0.07] px-2 py-1"
              data-testid="lane-war-scale-v11"
            >
              <p className="font-semibold text-amber-950 dark:text-amber-100">3 · 放大</p>
            </div>
            <div
              className="rounded-md border border-violet-500/40 bg-violet-500/[0.08] px-2 py-1"
              data-testid="lane-war-dormant-v11"
            >
              <p className="font-semibold text-violet-950 dark:text-violet-100">4 · 沉睡復活</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-3 gap-1 text-[9px] rounded-lg border-l-4 px-2 py-2 transition-shadow",
          partialHomepage
            ? "border-l-sky-500 bg-sky-500/[0.1] shadow-sm ring-1 ring-sky-400/40 ring-offset-1 ring-offset-background"
            : "border-l-border bg-muted/15"
        )}
        data-testid="grid-homepage-truth-tier-v11"
      >
        <div
          data-testid="truth-tier-salience-trusted-v11"
          className="rounded-md ring-1 ring-emerald-500/35 bg-emerald-500/[0.07] px-1.5 py-1"
        >
          <span className="font-bold text-foreground">Trusted</span>
          <span className="text-muted-foreground"> — 五區可下決策。</span>
        </div>
        <div data-testid="truth-tier-reference-only-v11" className="px-1.5 py-1 opacity-90">
          <span className="font-semibold text-foreground">Reference</span>
          <span className="text-muted-foreground"> — 敘事不覆蓋數值。</span>
        </div>
        <div data-testid="truth-tier-partial-v11" className="px-1.5 py-1">
          <span className="font-semibold text-amber-900 dark:text-amber-100">Partial</span>
          <span className="text-muted-foreground">
            {" "}
            — 仍執行五區＋沉睡；摘要僅參考。
          </span>
        </div>
      </div>

      <div className="space-y-4 pt-0.5">{children}</div>
    </div>
  );
}
