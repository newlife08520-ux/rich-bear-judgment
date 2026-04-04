import type { JudgmentType, JudgmentInput, UserSettings, ContentJudgmentInput, ContentType } from "@shared/schema";
import { judgmentTypeLabels, analysisModes, promptModeMap, promptModeLabels, contentPurposeLabels, contentDepthLabels } from "@shared/schema";

export function buildFinalSystemPrompt(settings: UserSettings, taskType: JudgmentType): string {
  const mode = promptModeMap[taskType];
  const modePromptKey = `mode${mode}Prompt` as keyof UserSettings;
  const corePart = (settings.coreMasterPrompt || "").trim();
  const modePart = ((settings[modePromptKey] as string) || "").trim();

  const parts = [corePart, modePart].filter(Boolean);
  const finalPrompt = parts.join("\n\n");

  const modeLabel = promptModeLabels[mode];
  console.log(`[PromptRouter] taskType=${taskType} → Mode ${mode} (${modeLabel}), core=${corePart.length} chars, mode=${modePart.length} chars, final=${finalPrompt.length} chars`);

  return finalPrompt;
}

export function buildJudgmentUserPrompt(input: JudgmentInput): string {
  const typeLabel = judgmentTypeLabels[input.type];
  const modeLabel = analysisModes[input.type]?.find((o) => o.id === input.objective)?.label || input.analysisMode || input.objective;

  const lines: string[] = [
    `## 審判任務`,
    `- 審判類型: ${typeLabel}`,
    `- 分析模式: ${modeLabel}`,
  ];

  if (input.notes) {
    lines.push(`- 補充說明: ${input.notes}`);
  }

  if (input.url) {
    lines.push(`- 目標網址: ${input.url}`);
  }

  if (input.adCopy) {
    lines.push(`\n## 廣告文案\n${input.adCopy}`);
  }

  if (input.metricsData && Object.keys(input.metricsData).length > 0) {
    lines.push(`\n## 廣告數據`);
    for (const [key, val] of Object.entries(input.metricsData)) {
      lines.push(`- ${key}: ${val}`);
    }
  }

  if (input.funnelData && Object.keys(input.funnelData).length > 0) {
    lines.push(`\n## 漏斗數據`);
    for (const [key, val] of Object.entries(input.funnelData)) {
      lines.push(`- ${key}: ${val}`);
    }
  }

  lines.push(`\n## 輸出要求`);
  lines.push(`請以 JSON 格式回傳完整審判結果，結構如下：`);
  lines.push(getOutputSchema(input.type));

  return lines.join("\n");
}

function getOutputSchema(type: JudgmentType): string {
  const diagnosisKeys: Record<JudgmentType, string[]> = {
    creative: ["hookStrength", "emotionalTension", "visualMemory", "conversionPower", "ctaClarity"],
    landing_page: ["persuasionFlow", "trustSignals", "priceSupport", "dropOffRisk", "mobileExperience"],
    fb_ads: ["creativeHealth", "audienceMatch", "fatigue", "budgetEfficiency", "scalability"],
    ga4_funnel: ["landingPageEfficiency", "productPageConversion", "cartAbandonment", "checkoutFriction", "overallFunnelHealth"],
  };

  const extraFields: Record<JudgmentType, string> = {
    creative: `"hookIdeas": ["string"], "ctaIdeas": ["string"], "openingFixes": ["string"], "captionSuggestions": ["string"]`,
    landing_page: `"deathPoints": ["string"], "rewriteIdeas": ["string"], "sectionFixes": [{"section":"string","problem":"string","suggestion":"string"}], "aovSuggestions": ["string"]`,
    fb_ads: `"metricsAnalysis": [{"metric":"string","value":"string","benchmark":"string","status":"good|warning|danger","note":"string"}], "fatigueSignals": ["string"], "audienceInsights": ["string"], "scalingAdvice": "string"`,
    ga4_funnel: `"funnelBreakpoints": [{"stage":"string","dropRate":number,"analysis":"string","fix":"string"}], "pageFixIdeas": ["string"], "checkoutFixes": ["string"], "trafficAdvice": "string"`,
  };

  const diagKeys = diagnosisKeys[type].map((k) => `"${k}": {"score": number(0-100), "analysis": "string"}`).join(", ");

  return `\`\`\`json
{
  "summary": {
    "score": number(0-100),
    "grade": "S|A|B|C|D|F",
    "verdict": "一句話判決(繁體中文,30-60字)",
    "topIssues": [{"title":"string","severity":"critical|high|medium","description":"string"}],
    "priorityActions": [{"order":number,"action":"string","impact":"high|medium|low"}],
    "recommendation": "launch|scale|hold|stop|fix_first",
    "recommendationNote": "string"
  },
  "detail": {
    "type": "${type}",
    "diagnosis": {${diagKeys}},
    "reasoning": "string(200-400字深度分析)",
    "executionSuggestions": ["string"],
    ${extraFields[type]}
  }
}
\`\`\`

重要規則：
- 所有文字必須使用繁體中文
- score 評分嚴格，普通素材通常在 30-55 分之間
- verdict 要犀利、直接、有記憶點
- 回傳純 JSON，不要包含 markdown 標記或其他文字`;
}

const contentTypeNames: Record<ContentType, string> = {
  image: "圖片素材",
  video: "影片素材",
  pdf: "PDF 提案 / 企劃書",
  url: "網頁 / 銷售頁 / 著陸頁",
  text: "文案 / 文字內容",
};

/** 僅組裝 content judgment 的 user prompt（供 /start 等搭配 workbench systemPrompt 使用） */
export function buildContentJudgmentUserPrompt(
  settings: UserSettings,
  input: ContentJudgmentInput,
  contentType: ContentType,
  judgmentType: JudgmentType,
): string {
  const purposeLabel = contentPurposeLabels[input.purpose];
  const depthLabel = contentDepthLabels[input.depth];

  const depthInstruction = input.depth === "quick"
    ? "請給出簡潔版審判，重點 3 條以內，完整拆解 2-3 段即可。"
    : "請給出完整版審判，重點 5 條，完整拆解 5-8 段，深入剖析每個面向。";

  const lines: string[] = [
    `## 內容審判任務`,
    `- 內容類型：${contentTypeNames[contentType]}`,
    `- 審判目的：${purposeLabel}`,
    `- 報告深度：${depthLabel}`,
    depthInstruction,
  ];

  if (input.url) lines.push(`- 目標網址：${input.url}`);
  if (input.text) lines.push(`\n## 待審判內容\n${input.text}`);
  if (input.notes) lines.push(`\n## 補充說明\n${input.notes}`);

  if (contentType === "video") {
    lines.push(`\n## 行銷影片審查重點`);
    lines.push(`你正在審查一支行銷影片，系統已自動擷取關鍵幀。`);
    lines.push(`請特別注意：`);
    lines.push(`1. 前 3 秒鉤子（第一張幀）是否能抓住注意力`);
    lines.push(`2. 畫面上的文字疊加（字卡、標語、價格）— 請讀出來並評估效果`);
    lines.push(`3. 中段是否有產品展示或使用情境`);
    lines.push(`4. 結尾是否有明確 CTA`);
    lines.push(`5. 整體節奏：畫面切換頻率是否適合短影音`);
    lines.push(`如果某幀看不清楚，請如實說明，不要猜測。`);
  }

  if (contentType === "pdf") {
    lines.push(`\n## PDF 審查重點`);
    lines.push(`你正在審查一份行銷提案或企劃書（PDF）。`);
    lines.push(`請特別注意：`);
    lines.push(`1. 整體結構：痛點 → 解方 → 證據 → 行動 是否清晰`);
    lines.push(`2. 文案品質：是否有說服力、語言精準度`);
    lines.push(`3. 視覺設計：排版專業度、圖文比例`);
    lines.push(`4. 數據使用：引用的數據是否支持論點`);
    lines.push(`5. CTA 或下一步行動是否明確`);
    lines.push(`如果 PDF 模糊或看不清楚，請如實說明。`);
  }

  lines.push(`\n## 輸出要求`);
  lines.push(`請以 JSON 格式回傳，結構如下：`);
  lines.push(`\`\`\`json
{
  "oneLineVerdict": "一句總判（20-40字，犀利有力，像總監在講話，例如：'這份提案有氣質，但現在還不夠會賣'）",
  "keyPoints": [
    "最大問題是什麼",
    "為什麼賣不動 / 品牌感不成立",
    "最該先改哪裡",
    "（可選）其他重點"
  ],
  "fullAnalysis": [
    {"title": "章節標題", "content": "深度分析內容（100-300字）"}
  ],
  "nextActions": [
    {"label": "動作標題（如：幫我重寫標題）", "description": "簡短說明為什麼要做這件事"}
  ],
  "followUpSuggestions": [
    "那你直接幫我改",
    "那影片腳本怎麼拍",
    "那頁面第一屏怎麼做"
  ]
}
\`\`\``);

  lines.push(`\n重要規則：`);
  lines.push(`- 所有文字必須使用繁體中文`);
  lines.push(`- oneLineVerdict 要犀利、直接、有記憶點，像真人總監在講話`);
  lines.push(`- fullAnalysis 的章節標題要有態度，不要用「分析」「報告」這種冷冰冰的詞`);
  lines.push(`- nextActions 要具體可執行，不要空泛建議`);
  lines.push(`- 回傳純 JSON，不要包含其他文字`);

  return lines.join("\n");
}

export function buildContentJudgmentPrompt(
  settings: UserSettings,
  input: ContentJudgmentInput,
  contentType: ContentType,
  judgmentType: JudgmentType,
): { systemPrompt: string; userPrompt: string } {
  const mode = promptModeMap[judgmentType];
  const modePromptKey = `mode${mode}Prompt` as keyof UserSettings;
  const corePart = (settings.coreMasterPrompt || "").trim();
  const modePart = ((settings[modePromptKey] as string) || "").trim();

  const purposeLabel = contentPurposeLabels[input.purpose];
  const depthLabel = contentDepthLabels[input.depth];

  const toneMap: Record<string, string> = {
    professional: "專業但有人味，像一個經驗老到的行銷總監在跟你開會",
    direct: "直接犀利，不繞圈子，像總監看了三秒就告訴你問題在哪",
    friendly: "溫暖但誠實，像一個懂你的行銷前輩在幫你看",
  };
  const tone = toneMap[settings.brandTone || "direct"] || toneMap.direct;

  const systemPrompt = [
    corePart,
    modePart,
    `你是一位頂尖行銷總監，正在審判一份${contentTypeNames[contentType]}。`,
    `目的：${purposeLabel}`,
    `語氣風格：${tone}`,
    `你的判斷必須犀利、有記憶點、像真人總監在講話，不是冷冰冰的分析報表。`,
    `所有文字必須使用繁體中文。`,
  ].filter(Boolean).join("\n\n");

  return { systemPrompt, userPrompt: buildContentJudgmentUserPrompt(settings, input, contentType, judgmentType) };
}
