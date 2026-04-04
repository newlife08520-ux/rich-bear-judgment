/**
 * 首頁第一屏外殼：作戰面板、資料可信層級、子區塊。
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
      className="rounded-2xl border border-border/55 bg-gradient-to-b from-slate-950/[0.06] via-background/60 to-background shadow-sm p-5 md:p-6 space-y-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">今日作戰面板</h2>
          <p className="text-xs text-muted-foreground max-w-xl leading-snug">
            大數字為目前日期範圍摘要；優先處理與放大／止血／復活見下方卡片。
          </p>
        </div>
      </header>

      <Collapsible defaultOpen={false} data-testid="collapsible-war-room-doctrine-v12">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/70">
          <span>查看決策說明</span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs" data-testid="block-command-hierarchy-v12">
            <div
              className="rounded-xl border-l-4 border-l-emerald-500/70 bg-emerald-500/[0.05] px-3 py-2"
              data-testid="lane-primary-command-surface-v12"
            >
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">主指令</p>
              <p className="text-muted-foreground mt-1 leading-tight">優先動作、可信數字帶、放大／救援／復活。</p>
            </div>
            <div
              className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2"
              data-testid="lane-secondary-decision-support-v12"
            >
              <p className="font-semibold text-amber-950 dark:text-amber-100">補充說明</p>
              <p className="text-muted-foreground mt-1 leading-tight">摘要與敘事補充，不覆蓋數值決策。</p>
            </div>
            <div
              className="rounded-xl border-l-4 border-l-slate-500/50 bg-slate-500/[0.04] px-3 py-2"
              data-testid="lane-diagnostics-deck-v12"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">診斷提示</p>
              <p className="text-muted-foreground mt-1 leading-tight">範圍、政策與資料品質提醒。</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs rounded-xl border-l-4 px-3 py-3 transition-shadow",
          partialHomepage
            ? "border-l-sky-500 bg-sky-500/[0.12] shadow-md ring-2 ring-sky-400/40 ring-offset-2 ring-offset-background"
            : "border-l-border bg-muted/15"
        )}
        data-testid="grid-homepage-truth-tier-v12"
      >
        <div
          data-testid="truth-tier-salience-trusted-v12"
          className="rounded-lg ring-1 ring-emerald-500/35 bg-emerald-500/[0.07] px-2 py-1.5"
        >
          <span className="font-bold text-foreground">可信決策</span>
          <span className="text-muted-foreground"> — 五大區可下決策。</span>
        </div>
        <div data-testid="truth-tier-reference-only-v12" className="px-2 py-1.5 opacity-90">
          <span className="font-semibold text-foreground">參考用</span>
          <span className="text-muted-foreground"> — 敘事不覆蓋數值。</span>
        </div>
        <div data-testid="truth-tier-partial-salience-v12" className="px-2 py-1.5 font-medium">
          <span className="text-sky-900 dark:text-sky-100">部分資料</span>
          <span className="text-muted-foreground"> — 第一屏會加粗提示；仍可依五大區與復活清單行動。</span>
        </div>
      </div>

      <div className="space-y-6 pt-0.5">{children}</div>
    </div>
  );
}
