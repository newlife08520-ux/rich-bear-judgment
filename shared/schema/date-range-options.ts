/** Batch 14.6：日期預設選項自 schema.ts 抽出（單一來源）。 */
export const dateRangeOptions = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "3", label: "近 3 天" },
  { value: "7", label: "近 7 天" },
  { value: "14", label: "近 14 天" },
  { value: "30", label: "近 30 天" },
  { value: "custom", label: "自訂" },
] as const;
