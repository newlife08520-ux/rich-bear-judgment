/** 從 location 解析 ?creativeId= 或 ?campaignId= */
export function getCreativeKeyFromUrl(loc: string): string | null {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return params.get("creativeId")?.trim() || params.get("campaignId")?.trim() || null;
}
