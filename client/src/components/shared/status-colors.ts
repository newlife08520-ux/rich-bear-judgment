/** Semantic status colors — Phase 8：語意色用在 dot／badge／border-l-4，卡片本體維持白底 */
export type StatusSemantic = "profit" | "loss" | "watch" | "dormant" | "info" | "neutral";

type Row = { bg: string; border: string; text: string; badge: string; dot: string; leftStripe: string };

const MAP: Record<StatusSemantic, Row> = {
  profit: {
    bg: "bg-white dark:bg-card",
    border: "border-slate-200 dark:border-border",
    text: "text-emerald-800 dark:text-emerald-200",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/50",
    dot: "bg-emerald-600 dark:bg-emerald-400",
    leftStripe: "border-l-emerald-500",
  },
  loss: {
    bg: "bg-white dark:bg-card",
    border: "border-slate-200 dark:border-border",
    text: "text-rose-800 dark:text-rose-200",
    badge: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/50",
    dot: "bg-rose-600 dark:bg-rose-400",
    leftStripe: "border-l-rose-500",
  },
  watch: {
    bg: "bg-white dark:bg-card",
    border: "border-slate-200 dark:border-border",
    text: "text-amber-900 dark:text-amber-200",
    badge: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/50",
    dot: "bg-amber-500 dark:bg-amber-400",
    leftStripe: "border-l-amber-500",
  },
  dormant: {
    bg: "bg-white dark:bg-card",
    border: "border-slate-200 dark:border-border",
    text: "text-indigo-900 dark:text-indigo-200",
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800/50",
    dot: "bg-indigo-600 dark:bg-indigo-400",
    leftStripe: "border-l-indigo-500",
  },
  info: {
    bg: "bg-white dark:bg-card",
    border: "border-slate-200 dark:border-border",
    text: "text-indigo-900 dark:text-indigo-200",
    badge: "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800/50",
    dot: "bg-indigo-600 dark:bg-indigo-400",
    leftStripe: "border-l-indigo-500",
  },
  neutral: {
    bg: "bg-white dark:bg-card",
    border: "border-slate-200 dark:border-border",
    text: "text-muted-foreground",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
    dot: "bg-slate-400 dark:bg-slate-500",
    leftStripe: "border-l-slate-400",
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
