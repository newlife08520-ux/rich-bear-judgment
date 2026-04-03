/**
 * Batch 11.3 v7：首頁第一屏「指揮面板」外殼 — 三跑道（立即執行／補資料再判／診斷）。
 */
import { cn } from "@/lib/utils";

export function HomepageCommandPanelV7Chrome({
  children,
  partialHomepage,
}: {
  children: React.ReactNode;
  partialHomepage: boolean;
}) {
  return (
    <div
      data-testid="section-homepage-first-screen-command-v7"
      className="rounded-xl border-2 border-slate-800/20 dark:border-slate-200/15 bg-gradient-to-b from-slate-950/[0.04] via-background/40 to-background shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 md:p-5 space-y-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Ops command</p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">今日指揮面板</h2>
          <p className="text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
            一眼先選跑道：<strong className="text-foreground/90">立即執行</strong> 今日最該動的三件事 →{" "}
            <strong className="text-foreground/90">補資料再判</strong> 時守住數值區 →{" "}
            <strong className="text-foreground/90">診斷</strong> 不當主決策。
          </p>
        </div>
        <div
          className="rounded-md border border-dashed border-primary/35 bg-primary/[0.04] px-2.5 py-1.5 text-[10px] text-muted-foreground max-w-xs leading-snug shrink-0"
          data-testid="block-command-panel-mission-clock"
        >
          30–60 秒：指令 → 資料真相 → 加碼／救援 → 沉睡復活；其餘摺疊為次級營運。
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <div
          className="rounded-lg border border-emerald-500/35 bg-emerald-500/[0.06] px-3 py-2 shadow-sm"
          data-testid="lane-command-execute-now"
        >
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">立即執行</p>
          <p className="text-muted-foreground mt-1 leading-snug">
            今日戰略指令 Top 3–5、加碼／救援焦點、沉睡復活名單（同一批次與範圍鍵）。
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2 shadow-sm",
            partialHomepage
              ? "border-sky-500/45 bg-sky-500/[0.08] ring-1 ring-sky-500/25"
              : "border-amber-500/30 bg-amber-500/[0.05]"
          )}
          data-testid="lane-command-needs-data"
        >
          <p className="font-semibold text-foreground">需補資料再判</p>
          <p className="text-muted-foreground mt-1 leading-snug">
            {partialHomepage
              ? "partial_data：摘要層可能晚到—以 action-center 數值與本卡「可用／僅參考」為準。"
              : "完整資料時仍可能缺敘事層—主決策永遠優先數值五區與三桶。"}
          </p>
        </div>
        <div
          className="rounded-lg border border-violet-500/35 bg-violet-500/[0.06] px-3 py-2 shadow-sm"
          data-testid="lane-command-diagnostics"
        >
          <p className="font-semibold text-violet-950 dark:text-violet-100">診斷（非主決策）</p>
          <p className="text-muted-foreground mt-1 leading-snug">
            政策條、範圍不一致、批次弱化—收在下方摺疊；不與今日指令混排。
          </p>
        </div>
      </div>

      <div className="space-y-6 pt-1">{children}</div>
    </div>
  );
}
