export const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部階段" },
  { value: "待初審", label: "待初審" },
  { value: "待驗證", label: "待驗證" },
  { value: "第一次決策點", label: "第一次決策點" },
  { value: "存活池", label: "存活池" },
  { value: "拉升池", label: "拉升池" },
  { value: "死亡池", label: "死亡池" },
];

export const LABEL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "Winner", label: "Winner" },
  { value: "Underfunded", label: "Underfunded" },
  { value: "Lucky", label: "Lucky（運氣單）" },
  { value: "NEEDS_MORE_DATA", label: "NeedsMoreData" },
  { value: "STABLE", label: "Stable" },
  { value: "FunnelWeak", label: "FunnelWeak" },
  { value: "Retired", label: "Retired" },
];

export const LABEL_DISPLAY: Record<string, string> = {
  Winner: "Winner",
  Underfunded: "Underfunded",
  Lucky: "Lucky",
  NeedsMoreData: "NeedsMoreData",
  NEEDS_MORE_DATA: "NeedsMoreData",
  STABLE: "Stable",
  Stable: "Stable",
  FunnelWeak: "FunnelWeak",
  Retired: "Retired",
};

export const DECISION_ACTIONS = ["開", "拉高", "維持", "關閉", "進延伸池"] as const;
