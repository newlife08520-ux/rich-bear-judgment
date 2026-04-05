import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type BandProps = {
  children: ReactNode;
  className?: string;
} & ComponentProps<"div">;

/**
 * Batch 14.7：主指揮權重 — 左側色帶＋淡底，避免與「整張等重卡片」混淆。
 */
export function CommandBand({ className, children, ...rest }: BandProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-emerald-500 p-5 dark:border-border dark:bg-card",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** 信任／真相帶 — 次一級權重，細邊界 */
export function TrustBand({ className, children, ...rest }: BandProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm py-2 px-3 md:px-4 dark:border-border dark:bg-card",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** 放大／救援等 spotlight */
export function SpotlightRail({ className, children, ...rest }: BandProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-amber-500 p-5 space-y-2 dark:border-border dark:bg-card",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** 沉睡復活主工作帶 */
export function DormantActionStrip({ className, children, ...rest }: BandProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-indigo-500 p-5 dark:border-border dark:bg-card",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** 診斷／教範 — 最低權重，虛線框 */
export function DiagnosticsFold({ className, children, ...rest }: BandProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-border dark:bg-muted/30 dark:text-muted-foreground",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
