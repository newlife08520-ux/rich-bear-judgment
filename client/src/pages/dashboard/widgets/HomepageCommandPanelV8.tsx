/**
 * Batch 12.0 v8：第一屏只回答四件事 — 今日先做／漏錢／放大／沉睡可救；更像指揮台。
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HomepageCommandPanelV8Chrome({
  children,
  partialHomepage,
}: {
  children: ReactNode;
  partialHomepage: boolean;
}) {
  return (
    <div
      data-testid="section-homepage-first-screen-command-v8"
      className="rounded-xl border-2 border-slate-800/25 dark:border-slate-200/20 bg-gradient-to-b from-slate-950/[0.06] via-background/45 to-background shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] p-4 md:p-5 space-y-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Command v8</p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">今日指揮台</h2>
          <p className="text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
            第一屏只判四件事：<strong className="text-foreground/90">先做什麼</strong>、<strong className="text-foreground/90">哪裡漏錢</strong>、
            <strong className="text-foreground/90">哪裡值得放大</strong>、<strong className="text-foreground/90">哪個沉睡值得救</strong>。其餘營運細節一律下摺。
          </p>
        </div>
        <div
          className="rounded-md border border-dashed border-primary/40 bg-primary/[0.05] px-2.5 py-1.5 text-[10px] text-muted-foreground max-w-xs leading-snug shrink-0"
          data-testid="block-command-panel-v8-mission-clock"
        >
          規則缺失、純診斷敘事不搶第一屏；diagnostics 不冒充 primary action。
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[11px]">
        <div
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.07] px-3 py-2 shadow-sm"
          data-testid="lane-command-today-first"
        >
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">1 · 今天先做什麼</p>
          <p className="text-muted-foreground mt-1 leading-snug">今日戰略指令 Top 3–5；可執行、同批次／範圍鍵。</p>
        </div>
        <div
          className="rounded-lg border border-rose-500/35 bg-rose-500/[0.06] px-3 py-2 shadow-sm"
          data-testid="lane-command-money-leak"
        >
          <p className="font-semibold text-rose-900 dark:text-rose-100">2 · 哪裡在漏錢</p>
          <p className="text-muted-foreground mt-1 leading-snug">救援／停損／高風險與 no-delivery 訊號（數值區）。</p>
        </div>
        <div
          className="rounded-lg border border-amber-500/35 bg-amber-500/[0.06] px-3 py-2 shadow-sm"
          data-testid="lane-command-scale-up"
        >
          <p className="font-semibold text-amber-950 dark:text-amber-100">3 · 哪些值得放大</p>
          <p className="text-muted-foreground mt-1 leading-snug">加碼／scale-ready；與 Pareto 同證據鏈。</p>
        </div>
        <div
          className="rounded-lg border border-violet-500/40 bg-violet-500/[0.07] px-3 py-2 shadow-sm"
          data-testid="lane-command-dormant-revive"
        >
          <p className="font-semibold text-violet-950 dark:text-violet-100">4 · 哪些 dormant 值得救</p>
          <p className="text-muted-foreground mt-1 leading-snug">沉睡復活排序＋捷徑；與 products／FB／CI 主工作流對齊。</p>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] rounded-lg border px-2 py-2",
          partialHomepage ? "border-sky-500/40 bg-sky-500/[0.05]" : "border-border/60 bg-muted/20"
        )}
        data-testid="grid-homepage-truth-tier-v8"
      >
        <div data-testid="truth-tier-trusted-v8">
          <span className="font-semibold text-foreground">Trusted</span>
          <span className="text-muted-foreground"> — action-center 五區數值、同 scope 批次鍵。</span>
        </div>
        <div data-testid="truth-tier-reference-only-v8">
          <span className="font-semibold text-foreground">Reference only</span>
          <span className="text-muted-foreground"> — 敘事／摘要層；晚到不覆蓋數值決策。</span>
        </div>
        <div data-testid="truth-tier-partial-v8">
          <span className="font-semibold text-foreground">Partial</span>
          <span className="text-muted-foreground"> — partial_data 時以標章＋本列為準。</span>
        </div>
      </div>

      <div className="space-y-6 pt-1">{children}</div>
    </div>
  );
}
