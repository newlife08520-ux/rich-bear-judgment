import { Globe, FileText, Layers } from "lucide-react";
import type { PageGroup } from "@shared/schema";

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
  最值得放量:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/50",
  流量有但接不住:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/50",
  首屏太弱: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/50",
  說服力不足:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/50",
  加購意圖低:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/50",
  "checkout阻力高":
    "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/50",
  可當模板:
    "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800/50",
  先修再投: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/50",
  結帳前掉最兇:
    "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/50",
  不適合導購: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
};

export const recommendationPageLabels: Record<string, string> = {
  add_traffic: "加流量",
  fix_first: "先修頁面",
  use_as_template: "可當模板",
  monitor: "持續觀察",
};

export const recommendationPageColors: Record<string, string> = {
  add_traffic:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/50",
  fix_first:
    "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/50",
  use_as_template:
    "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800/50",
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
  high: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/50",
  medium: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/50",
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/50",
};

export const priorityLabels: Record<string, string> = {
  high: "高優先",
  medium: "中優先",
  low: "低優先",
};
