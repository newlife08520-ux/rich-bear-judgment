export const MODES = [
  { id: "boss", label: "Boss 視角" },
  { id: "buyer", label: "投手視角" },
  { id: "creative", label: "創意視角" },
] as const;

export const MODE_OVERLAY_HINTS: Record<string, string> = {
  boss: "例：摘要先排風險與金額、建議動作優先、商業結論風格與長短。",
  buyer: "例：哪張表先看、rescue/scale 資訊是否預設展開、排序偏好、whyNotMore 呈現方式。",
  creative: "例：先看鉤子/前 3 秒/首圖/字幕、先給 3 方向或 1 完整版、輸出偏向創作或改稿建議。",
};

export function parseArrayStr(s: string | undefined): string[] {
  if (!s?.trim()) return [];
  return s
    .split(/[、,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function arrayToStr(arr: string[] | undefined): string {
  return (arr ?? []).join("、");
}
