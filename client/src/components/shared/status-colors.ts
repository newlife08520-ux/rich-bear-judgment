/** Semantic status colors */
export type StatusSemantic = "profit" | "loss" | "watch" | "dormant" | "info" | "neutral";

type Row = { bg: string; border: string; text: string; badge: string; dot: string; bar: string };

const MAP: Record<StatusSemantic, Row> = {
  profit: {
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    border: "border-[var(--status-profit)]/30",
    text: "text-[var(--status-profit)]",
    badge: "bg-[var(--status-profit-light)] text-[var(--status-profit)] border-[var(--status-profit)]/25",
    dot: "bg-[var(--status-profit)]",
    bar: "bg-[var(--status-profit)]",
  },
  loss: {
    bg: "bg-[var(--status-loss-surface)]",
    border: "border-[var(--status-loss)]/30",
    text: "text-[var(--status-loss)]",
    badge: "bg-[var(--status-loss-light)] text-[var(--status-loss)] border-[var(--status-loss)]/25",
    dot: "bg-[var(--status-loss)]",
    bar: "bg-[var(--status-loss)]",
  },
  watch: {
    bg: "bg-[var(--status-watch-surface)]",
    border: "border-[var(--status-watch)]/30",
    text: "text-[var(--status-watch)]",
    badge: "bg-[var(--status-watch-light)] text-[var(--status-watch)] border-[var(--status-watch)]/25",
    dot: "bg-[var(--status-watch)]",
    bar: "bg-[var(--status-watch)]",
  },
  dormant: {
    bg: "bg-violet-100 dark:bg-violet-950/40",
    border: "border-[var(--status-dormant)]/30",
    text: "text-[var(--status-dormant)]",
    badge: "bg-[var(--status-dormant-light)] text-[var(--status-dormant)] border-[var(--status-dormant)]/25",
    dot: "bg-[var(--status-dormant)]",
    bar: "bg-[var(--status-dormant)]",
  },
  info: {
    bg: "bg-[var(--status-info-surface)]",
    border: "border-[var(--status-info)]/30",
    text: "text-[var(--status-info)]",
    badge: "bg-[var(--status-info-light)] text-[var(--status-info)] border-[var(--status-info)]/25",
    dot: "bg-[var(--status-info)]",
    bar: "bg-[var(--status-info)]",
  },
  neutral: {
    bg: "bg-muted/40",
    border: "border-border/60",
    text: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border/60",
    dot: "bg-muted-foreground",
    bar: "bg-muted-foreground",
  },
};

export function statusClasses(semantic: StatusSemantic) {
  return MAP[semantic] ?? MAP.neutral;
}

export function getProductStatus(
  roas: number,
  breakEven: number | null | undefined,
  target: number | null | undefined
): StatusSemantic {
  if (!Number.isFinite(roas)) return "neutral";
  if (breakEven != null && roas < breakEven) return "loss";
  if (target != null && roas >= target) return "profit";
  if (target != null && roas < target * 0.85) return "watch";
  return "watch";
}

export function getActionStatus(actionText: string): StatusSemantic {
  const s = (actionText || "").toLowerCase();
  if (/close|stop|pause|止血|關閉|停|砍|降/.test(s)) return "loss";
  if (/scale|launch|加|擴|拉|放大/.test(s)) return "profit";
  if (/hold|觀察|維持|先別/.test(s)) return "watch";
  if (/復活|沉睡|喚醒/.test(s)) return "dormant";
  return "info";
}
