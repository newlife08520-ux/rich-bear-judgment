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
      className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-6 space-y-6 dark:border-border dark:bg-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3 dark:border-border">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">今日作戰面板</h2>
          <p className="text-xs text-muted-foreground max-w-xl leading-snug">
            大數字為目前日期範圍摘要；優先處理與放大／止血／復活見下方卡片。
          </p>
        </div>
      </header>

      <Collapsible defaultOpen={false} data-testid="collapsible-command-doctrine-v12">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/70">
          <span>查看決策說明</span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs" data-testid="block-command-hierarchy-v12">
            <div
              className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-emerald-500 px-3 py-2 shadow-sm dark:border-border dark:bg-card"
              data-testid="lane-primary-command-surface-v12"
            >
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">主指令</p>
              <p className="text-muted-foreground mt-1 leading-tight">優先動作、可信數字帶、放大／救援／復活。</p>
            </div>
            <div
              className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-amber-500 px-3 py-2 shadow-sm dark:border-border dark:bg-card"
              data-testid="lane-secondary-decision-support-v12"
            >
              <p className="font-semibold text-amber-900 dark:text-amber-200">補充說明</p>
              <p className="text-muted-foreground mt-1 leading-tight">摘要與敘事補充，不覆蓋數值決策。</p>
            </div>
            <div
              className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-slate-400 px-3 py-2 shadow-sm dark:border-border dark:bg-card"
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
          "grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs rounded-xl border border-slate-200 bg-white px-3 py-3 transition-shadow border-l-4 dark:border-border dark:bg-card",
          partialHomepage
            ? "border-l-indigo-500 shadow-md ring-2 ring-indigo-400/30 ring-offset-2 ring-offset-background dark:ring-indigo-500/25"
            : "border-l-slate-300 dark:border-l-border"
        )}
        data-testid="grid-homepage-truth-tier-v12"
      >
        <div
          data-testid="truth-tier-salience-trusted-v12"
          className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 dark:border-border dark:bg-muted/20"
        >
          <span className="font-bold text-emerald-800 dark:text-emerald-200">可信決策</span>
          <span className="text-muted-foreground"> — 五大區可下決策。</span>
        </div>
        <div data-testid="truth-tier-reference-only-v12" className="px-2 py-1.5 opacity-90">
          <span className="font-semibold text-foreground">參考用</span>
          <span className="text-muted-foreground"> — 敘事不覆蓋數值。</span>
        </div>
        <div data-testid="truth-tier-partial-salience-v12" className="px-2 py-1.5 font-medium">
          <span className="text-indigo-900 dark:text-indigo-100">部分資料</span>
          <span className="text-muted-foreground"> — 第一屏會加粗提示；仍可依五大區與復活清單行動。</span>
        </div>
      </div>

      <div className="space-y-6 pt-0.5">{children}</div>
    </div>
  );
}
