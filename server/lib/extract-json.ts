/**
 * 統一 JSON 擷取：審判官 chat 與 Gemini 報告共用。
 * 策略：1) ```json``` 區塊 2) 整段 JSON.parse 3) 首尾 { } 擷取。
 * 依 cursor_acceptance_gap_closure Step 4.1 AI 契約統一。
 */
const JSON_BLOCK_RE = /```(?:json)?\s*([\s\S]*?)```/;

export function extractJsonFromText(text: string): unknown {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const blockMatch = trimmed.match(JSON_BLOCK_RE);
  const toParse = blockMatch ? blockMatch[1].trim() : trimmed;
  if (!toParse) return null;

  try {
    return JSON.parse(toParse);
  } catch {
    const start = toParse.indexOf("{");
    const end = toParse.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(toParse.slice(start, end + 1));
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}
