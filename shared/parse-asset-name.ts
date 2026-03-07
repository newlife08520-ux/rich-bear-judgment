/**
 * 統一檔名解析：比例 + 主素材組建議。
 * 供 server（detect-media、upload）與 client（assets 表單）共用，規則一致。
 * 優先順序：metadata → filename → manual。
 */
import type { AssetAspectRatio } from "./schema";

const RATIO_VALUES: { ratio: AssetAspectRatio; value: number }[] = [
  { ratio: "9:16", value: 9 / 16 },
  { ratio: "4:5", value: 4 / 5 },
  { ratio: "1:1", value: 1 },
  { ratio: "16:9", value: 16 / 9 },
];

function closestAspectRatio(w: number, h: number): AssetAspectRatio {
  if (!h || h <= 0) return "1:1";
  const r = w / h;
  let best: AssetAspectRatio = "1:1";
  let bestDiff = Infinity;
  for (const { ratio, value } of RATIO_VALUES) {
    const diff = Math.abs(r - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

/**
 * 從字串解析比例。支援分隔符：x × : _
 * 例如：9x16、9:16、9_16、4x5、4:5、4_5、1x1、1:1、1_1、16x9、16:9、16_9
 */
export function parseAspectRatioFromText(text: string): AssetAspectRatio | null {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase().trim();
  const match = lower.match(/(\d+)\s*[x×:_]\s*(\d+)/);
  if (!match) return null;
  const w = parseInt(match[1]!, 10);
  const h = parseInt(match[2]!, 10);
  if (!h || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  return closestAspectRatio(w, h);
}

/**
 * 從檔名解析 SOP 變體代號（用於自動歸組）。
 * 規則：_A(、_A_、_B(、_B_、_C(、_C_ 等，即 _[字母][_ 或 (]
 * 回傳單一字母代號（如 "A"、"B"），未匹配則 null。
 */
export function parseVariantCodeFromFilename(fileName: string): string | null {
  if (!fileName || typeof fileName !== "string") return null;
  const match = fileName.trim().match(/_([A-Za-z])[\s]*[_(\[]/);
  return match ? match[1]!.toUpperCase() : null;
}

/**
 * 將變體代號轉成主素材組顯示名（如 A -> A版）。
 */
export function variantCodeToGroupDisplayName(code: string): string {
  const c = (code ?? "").trim().toUpperCase();
  return c ? `${c}版` : "";
}

/**
 * 從檔名建議主素材組名稱。
 * 優先：含「版」「類」的段落（如 A版、B版）；否則第一段（如 A、B、潔測泡泡）。
 * 支援 A、A版、B、B版、C、C版 等。
 */
export function parseSuggestedGroupNameFromFilename(fileName: string): string | null {
  const base = (fileName ?? "").replace(/\.[^.]+$/, "").trim();
  const segs = base.split(/[_\-.]+/).filter(Boolean);
  for (const seg of segs) {
    const t = seg.trim();
    if (!t) continue;
    if (/版$/.test(t) || /類$/.test(t)) return t;
  }
  const first = segs[0]?.trim();
  return first || null;
}
