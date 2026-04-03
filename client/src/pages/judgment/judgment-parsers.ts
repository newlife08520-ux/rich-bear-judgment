import type { ParsedJudgment, ProblemType } from "./judgment-types";

/** 從 AI 長文解析出固定區塊；無結構時盡力提取總判決、建議動作、關鍵理由（fallback）。舊資料無 score 時不填。 */
export function parseJudgmentContent(raw: string): ParsedJudgment {
  const out: ParsedJudgment = {
    verdict: "",
    actionFirst: "",
    problemType: null,
    suggestTask: null,
    confidence: null,
    reason: "",
    suggestions: "",
    evidence: "",
    impactAmount: "",
  };
  const text = raw.trim();
  if (!text) return out;

  const sections = new Map<string, string>();
  const headerRegex = /^#{1,3}\s*(.+?)\s*$/gm;
  let lastEnd = 0;
  let lastTitle = "";
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    if (lastTitle) {
      const body = text.slice(lastEnd, match.index).trim();
      if (body) sections.set(lastTitle, body);
    }
    lastTitle = match[1].trim().replace(/\s+/g, " ");
    lastEnd = match.index + match[0].length;
  }
  if (lastTitle) {
    const body = text.slice(lastEnd).trim();
    if (body) sections.set(lastTitle, body);
  }

  const get = (keys: string[]) => {
    for (const k of keys) {
      if (sections.has(k)) return sections.get(k)!;
    }
    for (const [title, body] of sections) {
      if (keys.some((k) => title.includes(k) || k.includes(title))) return body;
    }
    return "";
  };

  out.verdict =
    get(["一句總判決", "總判決", "判決", "結論"]) ||
    sections.values().next().value?.split(/\n\n/)[0]?.trim() ||
    "";
  out.actionFirst = get(["先做什麼", "建議動作", "建議", "行動建議"]) || "";
  const problemRaw = get(["問題類型", "類型"]);
  if (/創意|素材|影片|圖片/i.test(problemRaw)) out.problemType = "創意";
  else if (/商品頁|銷售頁|落地頁/i.test(problemRaw)) out.problemType = "商品頁";
  else if (/投放|廣告|文案/i.test(problemRaw)) out.problemType = "投放";
  else if (/漏斗|ga4|轉換/i.test(problemRaw)) out.problemType = "漏斗";
  out.reason = get(["詳細原因", "原因", "為什麼", "分析"]) || "";
  out.suggestions = get(["具體建議", "建議事項"]) || (out.actionFirst ? "" : get(["建議"]));
  out.evidence = get(["證據與指標", "證據", "指標", "數據"]) || "";
  const impactSection = get(["影響金額", "影響", "impactAmount"]);
  if (impactSection) out.impactAmount = impactSection.trim().slice(0, 80);

  const suggestRaw = get(["是否建議生成任務", "生成任務"]) || text;
  out.suggestTask =
    /是|建議|可產|生成任務/i.test(suggestRaw) && !/不建議|暫不/i.test(suggestRaw)
      ? true
      : /否|不建議/i.test(suggestRaw)
        ? false
        : null;
  const confRaw = get(["置信度"]) || text;
  if (/高|high/i.test(confRaw)) out.confidence = "high";
  else if (/中|medium/i.test(confRaw)) out.confidence = "medium";
  else if (/低|low/i.test(confRaw)) out.confidence = "low";

  if (!out.verdict && !sections.size) {
    const firstPara = text.split(/\n\n+/)[0]?.trim() ?? "";
    const firstSentence = firstPara.split(/[。！？]/)[0]?.trim() ?? firstPara.slice(0, 120);
    out.verdict = firstSentence;
    const bulletMatch = text.match(/(?:^|\n)([-*•]\s*.+|\d+[.)]\s*.+)(?:\n(?:[-*•]|\d+[.)]).+)*/gm);
    if (bulletMatch?.length) out.actionFirst = bulletMatch.slice(0, 5).join("\n").trim();
    out.reason = text.replace(firstPara, "").replace(out.actionFirst, "").trim().slice(0, 2000);
  }

  if (!out.impactAmount) {
    const fromText = extractAmountFromText(out.reason + " " + out.evidence + " " + out.verdict);
    if (fromText) out.impactAmount = fromText;
  }
  return out;
}

/** 從文字推導影響金額（與後端規則一致：約 N 萬、N 萬、NT$、影響...萬） */
export function extractAmountFromText(t: string): string {
  if (!t?.trim()) return "";
  const s = t.trim();
  const aboutWan = s.match(/(?:約|大約|估計)\s*(\d+(?:\.\d+)?)\s*萬/);
  if (aboutWan) return `約 ${aboutWan[1]} 萬`;
  const wan = s.match(/(\d+(?:\.\d+)?)\s*萬/);
  if (wan) return `${wan[1]} 萬`;
  const nt = s.match(/NT\s*\$?\s*[\d,]+(?:\s*元)?/);
  if (nt) return nt[0].trim();
  const impact = s.match(/影響[^\d]*(\d+(?:\.\d+)?)\s*萬/);
  if (impact) return `約 ${impact[1]} 萬`;
  return "";
}
