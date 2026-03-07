# AI 主腦系統規格

## 架構概述

5 段式 Prompt 組合系統，由 Core Master + 4 個 Mode Add-on 組成。

## Prompt 路由

| 審判類型 | Mode | 模式名稱 | Prompt Key |
|---------|------|---------|------------|
| creative | A | 素材煉金術 | modeAPrompt |
| landing_page | B | 轉單說服力 | modeBPrompt |
| fb_ads | C | 廣告投放判決 | modeCPrompt |
| ga4_funnel | D | 漏斗斷點審判 | modeDPrompt |

## 組合邏輯

```
最終 System Prompt = coreMasterPrompt + "\n\n" + mode{X}Prompt
```

- `buildFinalSystemPrompt(settings, taskType)` 在 `server/prompt-builder.ts`
- `buildJudgmentUserPrompt(input)` 組裝使用者送審內容

## Gemini 整合

- Model: `gemini-2.5-pro-preview-06-05`（可用 `GEMINI_MODEL` 環境變數覆蓋）
- API Key: 存在 `UserSettings.aiApiKey`
- 呼叫流程: `server/gemini.ts` → 取 settings → buildFinalSystemPrompt → buildJudgmentUserPrompt → Gemini API → parse JSON

## AI 輸出 JSON 結構

```json
{
  "summary": {
    "score": "number(0-100)",
    "grade": "S|A|B|C|D|F",
    "verdict": "一句話判決(30-60字)",
    "topIssues": [{"title":"string","severity":"critical|high|medium","description":"string"}],
    "priorityActions": [{"order":"number","action":"string","reason":"string","impact":"high|medium|low"}],
    "recommendation": "launch|scale|hold|stop|fix_first",
    "recommendationNote": "string"
  },
  "detail": {
    "type": "creative|landing_page|fb_ads|ga4_funnel",
    "diagnosis": { "各模組5維度": {"score":"number","analysis":"string"} },
    "reasoning": "200-400字深度分析",
    "executionSuggestions": ["string"],
    "...模組專屬欄位"
  }
}
```

## 各模組診斷維度

### Mode A - 素材 (creative)
hookStrength, emotionalTension, visualMemory, conversionPower, ctaClarity

### Mode B - 銷售頁 (landing_page)
persuasionFlow, trustSignals, priceSupport, dropOffRisk, mobileExperience

### Mode C - FB 廣告 (fb_ads)
creativeHealth, audienceMatch, fatigue, budgetEfficiency, scalability

### Mode D - GA4 漏斗 (ga4_funnel)
landingPageEfficiency, productPageConversion, cartAbandonment, checkoutFriction, overallFunnelHealth

## 評分規則
- 普通素材通常在 30-55 分
- 70 分以上代表真正優秀
- 低於 40 分語氣應更直接且帶有急迫感
- 所有輸出必須繁體中文

## Settings 頁面 (AI 主腦管理)

- 5 個可摺疊 Prompt 區塊，各有 token badge
- 每個區塊支援匯入(.txt/.md) / 匯出
- 最終預覽：Mode 選擇器 (A/B/C/D) 顯示 Core + 選定 Mode 組合
- Token 估算：CJK×1.5 + nonCJK÷4，WARNING_THRESHOLD = 8000

## 相關檔案
- `shared/schema.ts` - UserSettings, promptModeMap, promptModeLabels
- `server/prompt-builder.ts` - buildFinalSystemPrompt, buildJudgmentUserPrompt, getOutputSchema
- `server/gemini.ts` - Gemini API 呼叫
- `client/src/pages/settings.tsx` - AI 主腦管理 UI
