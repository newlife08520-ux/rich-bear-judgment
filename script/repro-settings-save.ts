/**
 * 重現 PUT /api/settings：用與前端相同的 payload 測試 schema 是否通過
 * 執行: npx tsx script/repro-settings-save.ts
 */
import { settingsSchema } from "../shared/schema";

// 模擬前端 form.getValues() 可能送出的幾種情況
const cases: Record<string, unknown>[] = [
  // 1. 完整物件，字串為空、enum 有值
  {
    ga4PropertyId: "",
    fbAccessToken: "",
    aiApiKey: "",
    systemPrompt: "",
    coreMasterPrompt: "",
    modeAPrompt: "",
    modeBPrompt: "",
    modeCPrompt: "",
    modeDPrompt: "",
    severity: "moderate",
    outputLength: "standard",
    brandTone: "professional",
    analysisBias: "conversion",
  },
  // 2. 缺少部分 optional 鍵（前端 values 可能只帶部分）
  {
    ga4PropertyId: "",
    fbAccessToken: "",
    aiApiKey: "",
    severity: "moderate",
    outputLength: "standard",
    brandTone: "professional",
    analysisBias: "conversion",
  },
  // 3. 有 undefined 的鍵
  {
    ga4PropertyId: "",
    fbAccessToken: "",
    aiApiKey: "",
    systemPrompt: undefined,
    coreMasterPrompt: undefined,
    modeAPrompt: undefined,
    modeBPrompt: undefined,
    modeCPrompt: undefined,
    modeDPrompt: undefined,
    severity: "moderate",
    outputLength: "standard",
    brandTone: "professional",
    analysisBias: "conversion",
  },
  // 4. GET /api/settings 回傳的完整物件（含驗證欄位）— 前端不會直接送這個，但若誤送會怎樣
  {
    userId: "1",
    ga4PropertyId: "",
    fbAccessToken: "",
    aiApiKey: "",
    systemPrompt: "",
    coreMasterPrompt: "",
    modeAPrompt: "",
    modeBPrompt: "",
    modeCPrompt: "",
    modeDPrompt: "",
    severity: "moderate",
    outputLength: "standard",
    brandTone: "professional",
    analysisBias: "conversion",
    fbStatus: "idle",
    gaStatus: "idle",
    aiStatus: "idle",
  },
];

console.log("=== PUT /api/settings 重現測試 ===\n");
for (let i = 0; i < cases.length; i++) {
  const payload = cases[i];
  const result = settingsSchema.safeParse(payload);
  console.log(`Case ${i + 1}:`, result.success ? "PASS" : "FAIL");
  if (!result.success) {
    console.log("  errors:", JSON.stringify(result.error.flatten(), null, 2));
  } else {
    console.log("  parsed keys:", Object.keys(result.data).sort().join(", "));
  }
  console.log("");
}
