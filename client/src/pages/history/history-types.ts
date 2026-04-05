import { Image, Globe, Megaphone, TrendingDown } from "lucide-react";
import type { JudgmentType } from "@shared/schema";

export const historyTypeIcons: Record<JudgmentType, typeof Image> = {
  creative: Image,
  landing_page: Globe,
  fb_ads: Megaphone,
  ga4_funnel: TrendingDown,
};

export const historyTypeColors: Record<JudgmentType, string> = {
  creative:
    "text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800/50",
  landing_page:
    "text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800/50",
  fb_ads: "text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-200 dark:border-amber-800/50",
  ga4_funnel:
    "text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-200 dark:border-emerald-800/50",
};

export const historyTypeIconBg: Record<JudgmentType, string> = {
  creative: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/50",
  landing_page: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  fb_ads: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  ga4_funnel: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50",
};
