/**
 * Batch 13.x v10：指揮艦橋 + 決策層級（現在／稍後／僅診斷）+ 信任分帶；partial 營運語意由 dashboard 內聯區塊補強。
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HomepageCommandPanelV10Chrome({
  children,
  partialHomepage,
}: {
  children: ReactNode;
  partialHomepage: boolean;
}) {
  return (
    <div
      data-testid="section-homepage-first-screen-command-v10"
      className="rounded-xl border-2 border-slate-800/35 dark:border-slate-200/30 bg-gradient-to-b from-slate-950/[0.09] via-background/52 to-background shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] p-4 md:p-5 space-y-3"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-2.5">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Command · v10</p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">今日指揮艦橋</h2>
          <p className="text-[10px] text-muted-foreground max-w-xl leading-snug">
            先做哪三件 · 信任分帶（Trusted／Reference／Partial）· 漏錢／放大／沉睡復活 — 其餘下摺；診斷不冒充主線決策。
          </p>
        </div>
        <div
          className="rounded-md border border-dashed border-primary/45 bg-primary/[0.04] px-2 py-1 text-[9px] text-muted-foreground max-w-[220px] leading-tight shrink-0"
          data-testid="block-war-room-deck-v10"
        >
          規則缺失／範圍漂移：只進「Decision soon」或 Diagnostics；不佔艦橋主決策位。
        </div>
      </header>

      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]"
        data-testid="block-command-hierarchy-v10"
      >
        <div
          className="rounded-lg border border-emerald-500/45 bg-emerald-500/[0.07] px-2.5 py-1.5"
          data-testid="lane-command-decision-now-v10"
        >
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Decision now</p>
          <p className="text-muted-foreground mt-0.5 leading-tight">今日 Top 動作、漏錢熱點、可信數值五區（同批次／scope）。</p>
        </div>
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-2.5 py-1.5"
          data-testid="lane-command-decision-soon-v10"
        >
          <p className="font-semibold text-amber-950 dark:text-amber-100">Decision soon</p>
          <p className="text-muted-foreground mt-0.5 leading-tight">放大標的、沉睡復活排序、Pareto／節奏—待數值確認後執行。</p>
        </div>
        <div
          className="rounded-lg border border-slate-500/35 bg-slate-500/[0.06] px-2.5 py-1.5"
          data-testid="lane-command-diagnostics-only-v10"
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">Diagnostics only</p>
          <p className="text-muted-foreground mt-0.5 leading-tight">規則缺失、範圍不一致、摘要晚到—只指引排查，不當結論。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5 text-[10px]">
        <div
          className="rounded-lg border border-emerald-500/45 bg-emerald-500/[0.08] px-2.5 py-1.5"
          data-testid="lane-war-today-first-v10"
        >
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">1 · 今日 Top 動作</p>
          <p className="text-muted-foreground mt-0.5 leading-tight">可執行指令；同批次鍵。</p>
        </div>
        <div
          className="rounded-lg border border-rose-500/40 bg-rose-500/[0.07] px-2.5 py-1.5"
          data-testid="lane-war-money-leak-v10"
        >
          <p className="font-semibold text-rose-900 dark:text-rose-100">2 · 漏錢熱點</p>
          <p className="text-muted-foreground mt-0.5 leading-tight">救援／停損／no-delivery。</p>
        </div>
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-2.5 py-1.5"
          data-testid="lane-war-scale-v10"
        >
          <p className="font-semibold text-amber-950 dark:text-amber-100">3 · 放大標的</p>
          <p className="text-muted-foreground mt-0.5 leading-tight">Scale-ready／Pareto 同鏈。</p>
        </div>
        <div
          className="rounded-lg border border-violet-500/45 bg-violet-500/[0.08] px-2.5 py-1.5"
          data-testid="lane-war-dormant-v10"
        >
          <p className="font-semibold text-violet-950 dark:text-violet-100">4 · Dormant 復活</p>
          <p className="text-muted-foreground mt-0.5 leading-tight">與 products／FB／CI 主排序對齊。</p>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px] rounded-lg border-2 px-2 py-2",
          partialHomepage ? "border-sky-500/50 bg-sky-500/[0.07]" : "border-border/70 bg-muted/25"
        )}
        data-testid="grid-homepage-truth-tier-v10"
      >
        <div
          data-testid="truth-tier-salience-trusted-v10"
          className="rounded-md ring-1 ring-emerald-500/35 bg-emerald-500/[0.06] px-1.5 py-1"
        >
          <span className="font-bold text-foreground">Trusted</span>
          <span className="text-muted-foreground"> — 五區數值可下決策。</span>
        </div>
        <div data-testid="truth-tier-reference-only-v10" className="px-1.5 py-1 opacity-90">
          <span className="font-semibold text-foreground">Reference</span>
          <span className="text-muted-foreground"> — 敘事晚到不覆蓋數值。</span>
        </div>
        <div data-testid="truth-tier-partial-v10" className="px-1.5 py-1">
          <span className="font-semibold text-amber-900 dark:text-amber-100">Partial</span>
          <span className="text-muted-foreground">
            {" "}
            — 可操作：<strong className="text-foreground/90">仍執行五區＋沉睡</strong>；摘要僅參考。
          </span>
        </div>
      </div>

      <div className="space-y-6 pt-0.5">{children}</div>
    </div>
  );
}
