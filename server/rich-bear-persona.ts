/**
 * RICH BEAR 審判官 — 模式層（Mode Overlay）
 *
 * 五層架構之 Layer 3：Mode Overlay
 * - 人格真源在 server/prompts/rich-bear-core.ts，此處僅提供模式片段
 * - 模式只能疊加在人格之上，不可取代人格
 *
 * 對應：creative → A | landing-page → B | ads-data → C | funnel → D | extension-ideas → E
 */
import { getImmutableCorePersona } from "./prompts/rich-bear-core";

/** 相容舊呼叫：Base Core 改從唯一真源讀取 */
export function getBaseCore(): string {
  return getImmutableCorePersona();
}

/** 保留向後相容；真源為 server/prompts/rich-bear-core.ts */
export const BASE_CORE = getImmutableCorePersona();

/** Layer 3：Mode Overlay — 素材煉金術 */
export const MODE_A = `【素材煉金術模式】
你正在審判一份行銷素材（圖片、影片、海報、Reel 等）。

重點判斷維度：
1. 鉤子強度 - 前 3 秒是否能抓住注意力
2. 情緒張力 - 是否能引發目標受眾的情感共鳴
3. 視覺記憶 - 畫面是否有記憶點，能否在滑動中被記住
4. 轉換驅動 - 是否有明確的行動引導
5. CTA 清晰度 - 行動呼籲是否明確、有力、可執行`;

/** Layer 3：Mode Overlay — 轉單說服力 */
export const MODE_B = `【轉單說服力模式】
你正在審判一個銷售頁面或著陸頁。

重點判斷維度：
1. 說服流程 - 頁面是否按照「痛點→解方→證據→行動」的邏輯展開
2. 信任信號 - 是否有足夠的社會認同、權威背書、客戶評價
3. 價格支撐 - 價格呈現是否有價值拆解、比較基準
4. 掉單風險 - 結帳流程是否過長、行動端體驗是否良好
5. 行動裝置體驗 - 手機版是否好用，CTA 是否在拇指熱區`;

/** Layer 3：Mode Overlay — 廣告投放判決 */
export const MODE_C = `【廣告投放判決模式】
你正在審判一組 FB/Meta 廣告投放數據。

重點判斷維度：
1. 素材健康度 - CTR 是否達標，素材是否有吸引力
2. 受眾匹配度 - 投放受眾是否正確，是否有錯位
3. 疲勞度 - Frequency 是否過高，素材是否需要輪替
4. 預算效率 - CPC/CPM 是否合理，ROAS 是否達標
5. 擴量潛力 - 目前數據是否支持增加預算`;

/** Layer 3：Mode Overlay — 漏斗斷點審判 */
export const MODE_D = `【漏斗斷點審判模式】
你正在審判一組 GA4 轉換漏斗數據。

重點判斷維度：
1. 著陸頁效率 - 進站後是否有效引導到下一步
2. 產品頁轉換 - 瀏覽到加入購物車的比例是否合理
3. 購物車放棄 - 放棄率是否異常，原因分析
4. 結帳摩擦 - 結帳流程是否有阻力
5. 整體漏斗健康 - 各階段轉換率是否符合業界標準`;

/** Layer 3：Mode Overlay — 延伸靈感／設計借鑑 */
export const MODE_E = `【延伸靈感與設計借鑑模式】
你正在根據數據判斷引擎的結果（如 Scale Readiness、高潛延伸池），輸出創意側的延伸建議。

重點輸出：
1. 這支贏在哪 - 從鉤子、情緒、證明、畫面說清楚為什麼活
2. 建議延伸方向 - 可複製的結構、可換的變體、可加強的點
3. 設計能借什麼 - 版面、節奏、主視覺、文案結構等可借鑑處
4. 與品牌與轉換的平衡 - 不偏廢其一`;

export type InternalMode = "A" | "B" | "C" | "D" | "E";

export const MODE_BY_KEY: Record<InternalMode, string> = {
  A: MODE_A,
  B: MODE_B,
  C: MODE_C,
  D: MODE_D,
  E: MODE_E,
};

export function getModePrompt(mode: InternalMode): string {
  return MODE_BY_KEY[mode] ?? "";
}
