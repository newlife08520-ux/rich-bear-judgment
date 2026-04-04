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
        "rounded-lg border-l-4 border-l-emerald-600/85 bg-gradient-to-r from-emerald-500/[0.08] to-transparent pl-3 py-2.5",
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
      className={cn("rounded-md border-y border-border/45 bg-muted/[0.12] py-2 px-2 md:px-3", className)}
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
        "rounded-lg border-l-4 border-l-amber-500/75 bg-amber-500/[0.06] pl-3 py-2 space-y-2",
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
        "rounded-lg border-l-4 border-violet-500/80 bg-violet-500/[0.07] pl-3 py-2",
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
        "rounded-md border border-dashed border-muted-foreground/40 bg-muted/[0.08] px-2 py-1.5 text-xs text-muted-foreground",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
