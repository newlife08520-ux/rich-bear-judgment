/** Semantic status colors — Phase 2：全對齊 index.css `var(--status-*)`（dot／badge／border-l-4） */
export type StatusSemantic = "profit" | "loss" | "watch" | "dormant" | "info" | "neutral";

type Row = { bg: string; border: string; text: string; badge: string; dot: string; leftStripe: string };

const MICRO_BADGE =
  "border px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-none";

const MAP: Record<StatusSemantic, Row> = {
  profit: {
    bg: "bg-card",
    border: "border-border",
    text: "text-[var(--status-profit)]",
    badge: `bg-[var(--status-profit-surface)] text-[var(--status-profit)] border-[var(--status-profit-light)] ${MICRO_BADGE}`,
    dot: "bg-[var(--status-profit)]",
    leftStripe: "border-l-[var(--status-profit)]",
  },
  loss: {
    bg: "bg-card",
    border: "border-border",
    text: "text-[var(--status-loss)]",
    badge: `bg-[var(--status-loss-surface)] text-[var(--status-loss)] border-[var(--status-loss-light)] ${MICRO_BADGE}`,
    dot: "bg-[var(--status-loss)]",
    leftStripe: "border-l-[var(--status-loss)]",
  },
  watch: {
    bg: "bg-card",
    border: "border-border",
    text: "text-[var(--status-watch)]",
    badge: `bg-[var(--status-watch-surface)] text-[var(--status-watch)] border-[var(--status-watch-light)] ${MICRO_BADGE}`,
    dot: "bg-[var(--status-watch)]",
    leftStripe: "border-l-[var(--status-watch)]",
  },
  dormant: {
    bg: "bg-card",
    border: "border-border",
    text: "text-[var(--status-dormant)]",
    badge: `bg-[var(--status-dormant-surface)] text-[var(--status-dormant)] border-[var(--status-dormant-light)] ${MICRO_BADGE}`,
    dot: "bg-[var(--status-dormant)]",
    leftStripe: "border-l-[var(--status-dormant)]",
  },
  info: {
    bg: "bg-card",
    border: "border-border",
    text: "text-[var(--status-info)]",
    badge: `bg-[var(--status-info-surface)] text-[var(--status-info)] border-[var(--status-info-light)] ${MICRO_BADGE}`,
    dot: "bg-[var(--status-info)]",
    leftStripe: "border-l-[var(--status-info)]",
  },
  neutral: {
    bg: "bg-card",
    border: "border-border",
    text: "text-muted-foreground",
    badge:
      "bg-muted/30 text-muted-foreground border border-border px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-none",
    dot: "bg-muted-foreground",
    leftStripe: "border-l-muted-foreground/45",
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
