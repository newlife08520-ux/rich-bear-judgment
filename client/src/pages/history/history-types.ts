import { Image, Globe, Megaphone, TrendingDown } from "lucide-react";
import type { JudgmentType } from "@shared/schema";

const SEM_PROFIT =
  "text-[var(--status-profit)] bg-[var(--status-profit-surface)] border border-[var(--status-profit-light)]";
const SEM_WATCH =
  "text-[var(--status-watch)] bg-[var(--status-watch-surface)] border border-[var(--status-watch-light)]";
const SEM_DORMANT =
  "text-[var(--status-dormant)] bg-[var(--status-dormant-surface)] border border-[var(--status-dormant-light)]";

export const historyTypeIcons: Record<JudgmentType, typeof Image> = {
  creative: Image,
  landing_page: Globe,
  fb_ads: Megaphone,
  ga4_funnel: TrendingDown,
};

export const historyTypeColors: Record<JudgmentType, string> = {
  creative: SEM_DORMANT,
  landing_page: SEM_DORMANT,
  fb_ads: SEM_WATCH,
  ga4_funnel: SEM_PROFIT,
};

export const historyTypeIconBg: Record<JudgmentType, string> = {
  creative: SEM_DORMANT,
  landing_page: SEM_DORMANT,
  fb_ads: SEM_WATCH,
  ga4_funnel: SEM_PROFIT,
};
