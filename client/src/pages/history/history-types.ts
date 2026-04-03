import { Image, Globe, Megaphone, TrendingDown } from "lucide-react";
import type { JudgmentType } from "@shared/schema";

export const historyTypeIcons: Record<JudgmentType, typeof Image> = {
  creative: Image,
  landing_page: Globe,
  fb_ads: Megaphone,
  ga4_funnel: TrendingDown,
};

export const historyTypeColors: Record<JudgmentType, string> = {
  creative: "text-violet-700 bg-violet-50 border-violet-200",
  landing_page: "text-blue-700 bg-blue-50 border-blue-200",
  fb_ads: "text-amber-700 bg-amber-50 border-amber-200",
  ga4_funnel: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

export const historyTypeIconBg: Record<JudgmentType, string> = {
  creative: "bg-violet-100 text-violet-600",
  landing_page: "bg-blue-100 text-blue-600",
  fb_ads: "bg-amber-100 text-amber-600",
  ga4_funnel: "bg-emerald-100 text-emerald-600",
};
