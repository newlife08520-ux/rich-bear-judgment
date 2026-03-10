/**
 * 角色視角補充 Overlay 內容驗證：
 * 此頁不可發布「人格級」內容，僅允許視角補充、輸出偏向、呈現優先順序等。
 * 人格真源與 Hidden Calibration 由系統固定，不可由設定頁覆蓋或重寫。
 */

/** 人格級高風險語句（出現即視為不當，阻擋發布） */
const PERSONA_LEVEL_BLOCK_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /你是\s*[^\n。]+(?:總監|顧問|審判官|AI|助理|角色)/i, label: "人格定義起手句（你是…總監/顧問/審判官）" },
  { pattern: /你的最高任務/i, label: "最高任務" },
  { pattern: /角色核心|【角色|Identity】/i, label: "角色核心" },
  { pattern: /分數哲學|Score Philosophy/i, label: "分數哲學" },
  { pattern: /Hidden Calibration|隱性校準原則/i, label: "Hidden Calibration" },
  { pattern: /情緒觸發規則|Emotional Trigger Rule/i, label: "情緒觸發規則" },
  { pattern: /視覺衝擊規則|Visual Impact Rule/i, label: "視覺衝擊規則" },
  { pattern: /品牌感與爆款感平衡|Brand x Conversion Balance/i, label: "品牌與轉換平衡" },
  { pattern: /禁止事項|Forbidden/i, label: "禁止事項" },
  { pattern: /拒絕平庸語言|No Mediocrity/i, label: "拒絕平庸語言" },
  { pattern: /你必須像總監|你是一位總監|你是一位顧問|你是一位審判官/i, label: "人格起手句" },
  { pattern: /你是一位\s*[^\n。]*(?:總監|顧問|審判官)/i, label: "人格起手句（你是一位…）" },
];

export interface OverlayValidationResult {
  ok: boolean;
  /** 若 ok 為 false，說明為何不通過 */
  reason?: string;
  /** 命中的高風險標籤（供前端顯示） */
  matchedLabel?: string;
}

/**
 * 驗證內容是否為「人格級」不當內容。
 * 通過則 ok=true；不通過則 ok=false 並回傳 reason / matchedLabel。
 */
export function validateOverlayContent(content: string): OverlayValidationResult {
  const trimmed = (content ?? "").trim();
  if (!trimmed) return { ok: true };

  for (const { pattern, label } of PERSONA_LEVEL_BLOCK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: `此區僅能填寫「視角補充」與「輸出偏向」，不可重寫人格或校準層。偵測到不當內容：${label}。請移除人格級描述，改寫為該視角下的補充偏好、呈現優先順序或輸出規則即可。`,
        matchedLabel: label,
      };
    }
  }
  return { ok: true };
}
