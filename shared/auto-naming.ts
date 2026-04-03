/**
 * 階段三：SOP 自動命名引擎 (Auto-Naming Engine)
 * 依表單動態變數（產品名、素材策略、文案簡稱、受眾代碼等）生成 Campaign / Ad Set / Ad 名稱。
 * 公式：Campaign/Ad Set = [活動目標](原始)[MMDD]-[產品名]-[素材策略]+[文案簡稱]-[受眾代碼]
 *      Ad = (原)混[組名]+[文案簡稱] 或 [組名]+[文案簡稱]
 */

/** 命名引擎輸入：來自表單 + 系統日期 + 主素材組（皆由投手填寫或系統帶入） */
export interface AutoNamingInput {
  /** 活動目標前綴，如 "轉換次數(原始)" */
  objectivePrefix: string;
  /** 產品名，如 "小淨靈"（預設可帶入素材包名稱） */
  productName: string;
  /** 素材策略，如 "3影K"、"2圖1影" */
  materialStrategy: string;
  /** 文案簡稱，如 "抓住文"、"痛點文" */
  headlineSnippet: string;
  /** 系統當天 MMDD */
  dateMMDD: string;
  /** 該筆 Ad Set 的受眾代碼，如 "T"、"BUNA"、"廣泛" */
  audienceCode: string;
  /** 該組主素材組顯示名，如 "A版" */
  groupDisplayName: string;
  /** 該組內比例，用於判斷是否「混比例」→ Ad 前綴 (原)混 */
  aspectRatiosInGroup: Array<"9:16" | "4:5" | "1:1" | "16:9">;
}

/** 命名引擎輸出 */
export interface AutoNamingResult {
  campaignName: string;
  adSetName: string;
  adName: string;
}

/**
 * 動態生成 Campaign / Ad Set / Ad 名稱（依 SOP，無硬編碼）。
 * Campaign/Ad Set = [活動目標](原始)[MMDD]-[產品名]-[素材策略]+[文案簡稱]-[受眾代碼]
 * Ad：混比例(4:5/1:1+9:16) → (原)混[組名]+[文案簡稱]；單一比例 → [組名]+[文案簡稱]
 */
export function generateSOPNames(input: AutoNamingInput): AutoNamingResult {
  const {
    objectivePrefix,
    productName,
    materialStrategy,
    headlineSnippet,
    dateMMDD,
    audienceCode,
    groupDisplayName,
    aspectRatiosInGroup,
  } = input;

  const campaignName = [
    objectivePrefix,
    dateMMDD,
    "-",
    productName,
    "-",
    materialStrategy,
    "+",
    headlineSnippet,
    "-",
    audienceCode,
  ]
    .filter(Boolean)
    .join("");

  const adSetName = campaignName;

  const hasFeedLike = aspectRatiosInGroup.includes("4:5") || aspectRatiosInGroup.includes("1:1");
  const hasStoryReels = aspectRatiosInGroup.includes("9:16");
  const isMixedRatio = hasFeedLike && hasStoryReels;
  const adPrefix = isMixedRatio ? "(原)混" : "";
  const adName = `${adPrefix}${groupDisplayName}+${headlineSnippet}`;

  return { campaignName, adSetName, adName };
}

// ---------- Mock 資料示範 ----------
export const mockNamingInput: AutoNamingInput = {
  objectivePrefix: "轉換次數(原始)",
  productName: "小淨靈",
  materialStrategy: "3影K",
  headlineSnippet: "抓住文",
  dateMMDD: "0305",
  audienceCode: "T",
  groupDisplayName: "A版",
  aspectRatiosInGroup: ["4:5", "9:16"],
};

export const mockNamingResult = generateSOPNames(mockNamingInput);
// 預期：campaignName = "轉換次數(原始)0305-小淨靈-3影K+抓住文-T"
//       adName = "(原)混A版+抓住文"
