import { Globe, FileText, Layers } from "lucide-react";
import type { PageGroup } from "@shared/schema";

const SEM_PROFIT =
  "bg-[var(--status-profit-surface)] text-[var(--status-profit)] border border-[var(--status-profit-light)]";
const SEM_LOSS =
  "bg-[var(--status-loss-surface)] text-[var(--status-loss)] border border-[var(--status-loss-light)]";
const SEM_WATCH =
  "bg-[var(--status-watch-surface)] text-[var(--status-watch)] border border-[var(--status-watch-light)]";
const SEM_DORMANT =
  "bg-[var(--status-dormant-surface)] text-[var(--status-dormant)] border border-[var(--status-dormant-light)]";

export type AssetView = "official_site" | "single_page" | "full_site";

export type DetailedSortKey =
  | "sessions"
  | "conversionRate"
  | "revenue"
  | "bounceRate"
  | "pageviews"
  | "avgEngagementTime";

export type SortKey =
  | "sessions"
  | "avgDuration"
  | "bounceRate"
  | "addToCartRate"
  | "purchaseRate"
  | "overallConversionRate"
  | "judgmentScore"
  | "opportunityScore";

export type SortDir = "asc" | "desc";

export const aiLabelColors: Record<string, string> = {
  最值得放量: SEM_PROFIT,
  流量有但接不住: SEM_WATCH,
  首屏太弱: SEM_LOSS,
  說服力不足: SEM_WATCH,
  加購意圖低: SEM_WATCH,
  "checkout阻力高": SEM_LOSS,
  可當模板: SEM_DORMANT,
  先修再投: SEM_LOSS,
  結帳前掉最兇: SEM_LOSS,
  不適合導購: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
};

export const recommendationPageLabels: Record<string, string> = {
  add_traffic: "加流量",
  fix_first: "先修頁面",
  use_as_template: "可當模板",
  monitor: "持續觀察",
};

export const recommendationPageColors: Record<string, string> = {
  add_traffic: SEM_PROFIT,
  fix_first: SEM_LOSS,
  use_as_template: SEM_DORMANT,
  monitor:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
};

export const pageGroupLabels: Record<PageGroup, string> = {
  products: "商品頁",
  collections: "集合頁",
  pages: "一般頁面",
  blogs: "文章頁",
  cart: "購物車",
  checkout: "結帳",
  homepage: "首頁",
  other: "其他",
};

export const assetViewConfig: Record<AssetView, { label: string; icon: typeof Globe; description: string }> = {
  official_site: { label: "官網", icon: Globe, description: "多頁式官方網站分析" },
  single_page: { label: "一頁式", icon: FileText, description: "一頁式銷售頁分析" },
  full_site: { label: "全站", icon: Layers, description: "跨頁總覽與重大異常" },
};

export interface AssetPageGroup {
  key: string;
  label: string;
  description: string;
  matchGroups: PageGroup[];
}

export const assetViewPageGroups: Record<AssetView, AssetPageGroup[]> = {
  official_site: [
    { key: "guide", label: "導購", description: "引導消費者購買的頁面", matchGroups: ["homepage"] },
    { key: "product", label: "商品頁", description: "商品詳情與介紹", matchGroups: ["products"] },
    { key: "category", label: "分類頁", description: "商品分類與集合", matchGroups: ["collections"] },
    { key: "faq", label: "FAQ", description: "常見問題與說明", matchGroups: ["pages", "blogs"] },
    { key: "brand", label: "品牌頁", description: "品牌形象與故事", matchGroups: ["other"] },
  ],
  single_page: [
    { key: "hero", label: "首屏", description: "首屏吸引力與跳出率", matchGroups: ["homepage"] },
    { key: "trust", label: "信任感", description: "社會證明與信任元素", matchGroups: ["pages", "blogs"] },
    { key: "cta", label: "CTA", description: "行動呼籲按鈕區塊", matchGroups: ["products"] },
    { key: "cart_section", label: "購物車", description: "加購與購物車體驗", matchGroups: ["cart", "collections"] },
    { key: "checkout_section", label: "結帳", description: "結帳流程與轉換", matchGroups: ["checkout"] },
  ],
  full_site: [
    {
      key: "overview",
      label: "跨頁總覽",
      description: "所有頁面的總覽分析",
      matchGroups: ["homepage", "products", "collections", "pages", "blogs", "cart", "checkout", "other"],
    },
    {
      key: "anomaly",
      label: "重大異常",
      description: "異常跳出或轉換驟降的頁面",
      matchGroups: ["homepage", "products", "collections", "pages", "blogs", "cart", "checkout", "other"],
    },
  ],
};

export const priorityColors: Record<string, string> = {
  high: SEM_LOSS,
  medium: SEM_WATCH,
  low: SEM_PROFIT,
};

export const priorityLabels: Record<string, string> = {
  high: "高優先",
  medium: "中優先",
  low: "低優先",
};
