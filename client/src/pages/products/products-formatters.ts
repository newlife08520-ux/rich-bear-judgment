export function formatCurrency(value: number): string {
  return `NT$ ${value.toLocaleString()}`;
}

export const EVIDENCE_LABELS: Record<string, string> = {
  ads_only: "廣告層推測",
  ga_verified: "已有 GA 證據",
  rules_missing: "規則缺失",
  insufficient_sample: "樣本不足",
  no_delivery: "尚未投遞",
};

export function getProductNameFromUrl(loc: string): string | null {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return params.get("productName")?.trim() || null;
}
