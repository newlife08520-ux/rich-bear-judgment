/**
 * 投放中心：強制在落地頁網址加上 UTM 參數，供 FB 與 GA4 漏斗對接。
 */

export interface UtmParams {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
}

/**
 * 在 landingPageUrl 上強制加上 UTM（若已有同名參數則覆蓋）。
 * 規則：utm_source=meta, utm_medium=cpc, utm_campaign=[產品名], utm_content=[素材策略]+[文案簡稱]
 * 防呆：依是否有 ? 決定用 ? 或 & 拼接，並合併既有 query 避免重複。
 */
export function appendUtmToLandingUrl(url: string | undefined, params: UtmParams): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";

  const base = raw.includes("?") ? raw.slice(0, raw.indexOf("?")) : raw;
  const existingQuery = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  const merged = new URLSearchParams(existingQuery);
  merged.set("utm_source", "meta");
  merged.set("utm_medium", "cpc");
  merged.set("utm_campaign", (params.productName || "product").trim());
  merged.set("utm_content", `${(params.materialStrategy || "").trim()}+${(params.headlineSnippet || "").trim()}`.trim() || "content");
  return `${base}?${merged.toString()}`;
}
