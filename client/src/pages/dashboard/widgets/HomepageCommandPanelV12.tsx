/**
 * Batch 15.5 v12：War-room 第一屏 — 15–20 秒內鎖定 Top3／truth tier／主戰場；層級與 v11 對齊，testid 升級 v12。
 */
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function HomepageCommandPanelV12Chrome({
  children,
  partialHomepage,
}: {
  children: ReactNode;
  partialHomepage: boolean;
}) {
  return (
    <div
      data-testid="section-homepage-first-screen-command-v12"
      className="rounded-xl border border-border/55 bg-gradient-to-b from-slate-950/[0.08] via-background/60 to-background shadow-sm p-3 md:p-4 space-y-3"
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">War room · v12</p>
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">今日作戰面板</h2>
          <p className="text-[9px] text-muted-foreground max-w-xl leading-snug">
            目標：15–20 秒內看懂「今天先打哪 3 件事」、資料可信層級、放大／救援／沉睡主焦點。
          </p>
        </div>
        <div
          className="rounded border border-dashed border-primary/40 bg-primary/[0.03] px-1.5 py-1 text-[8px] text-muted-foreground max-w-[200px] leading-tight shrink-0"
          data-testid="block-war-room-deck-v12"
        >
          利潤細表／Pareto 深解 → 次級收合；Diagnostics 獨立帶。
        </div>
      </header>

      <Collapsible defaultOpen={false} data-testid="collapsible-war-room-doctrine-v12">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border-y border-border/40 bg-muted/10 px-2 py-1 text-[9px] font-medium text-muted-foreground hover:bg-muted/25">
          <span>編隊教範（Primary command／Secondary support／Diagnostics）</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1.5 pt-1.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[9px]" data-testid="block-command-hierarchy-v12">
            <div
              className="rounded-md border-l-2 border-l-emerald-500/70 bg-emerald-500/[0.05] px-2 py-1"
              data-testid="lane-primary-command-surface-v12"
            >
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">Primary command</p>
              <p className="text-muted-foreground mt-0.5 leading-tight">Top 3、truth band、scale／rescue／dormant 主帶。</p>
            </div>
            <div
              className="rounded-md border border-amber-500/40 bg-amber-500/[0.07] px-2 py-1"
              data-testid="lane-secondary-decision-support-v12"
            >
              <p className="font-semibold text-amber-950 dark:text-amber-100">Secondary support</p>
              <p className="text-muted-foreground mt-0.5 leading-tight">Digest、教範、非阻斷敘事。</p>
            </div>
            <div
              className="rounded-md border-l-2 border-dashed border-l-slate-500/50 bg-slate-500/[0.04] px-2 py-1"
              data-testid="lane-diagnostics-deck-v12"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">Diagnostics</p>
              <p className="text-muted-foreground mt-0.5 leading-tight">政策、範圍漂移、batch 弱信號。</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-3 gap-1 text-[9px] rounded-lg border-l-4 px-2 py-2 transition-shadow",
          partialHomepage
            ? "border-l-sky-500 bg-sky-500/[0.12] shadow-md ring-2 ring-sky-400/50 ring-offset-2 ring-offset-background"
            : "border-l-border bg-muted/15"
        )}
        data-testid="grid-homepage-truth-tier-v12"
      >
        <div
          data-testid="truth-tier-salience-trusted-v12"
          className="rounded-md ring-1 ring-emerald-500/35 bg-emerald-500/[0.07] px-1.5 py-1"
        >
          <span className="font-bold text-foreground">Trusted</span>
          <span className="text-muted-foreground"> — 五區可下決策。</span>
        </div>
        <div data-testid="truth-tier-reference-only-v12" className="px-1.5 py-1 opacity-90">
          <span className="font-semibold text-foreground">Reference</span>
          <span className="text-muted-foreground"> — 敘事不覆蓋數值。</span>
        </div>
        <div data-testid="truth-tier-partial-salience-v12" className="px-1.5 py-1 font-medium">
          <span className="text-sky-900 dark:text-sky-100">Partial</span>
          <span className="text-muted-foreground"> — 第一屏加粗提示；仍執行五區＋沉睡。</span>
        </div>
      </div>

      <div className="space-y-4 pt-0.5">{children}</div>
    </div>
  );
}
